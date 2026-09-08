import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { loadConfig, parseModel, validateConfig, type RateLimitFallbackConfig, type FallbackModelObject } from "./config"
import { createLogger } from "./log"

interface MessageInfo {
  id: string
  role: "user" | "assistant"
  sessionID: string
  model?: {
    providerID: string
    modelID: string
  }
  agent?: string
}

interface MessagePart {
  id: string
  type: string
  text?: string
  mime?: string
  filename?: string
  url?: string
  name?: string
  synthetic?: boolean
}

interface MessageWithParts {
  info: MessageInfo
  parts: MessagePart[]
}

interface SessionState {
  index: number
  queue: number[]
  inflight: boolean
  start: number
  retries: number
}

const sessions = new Map<string, SessionState>()

function isRateLimitMessage(message: string, patterns: string[]): boolean {
  const lower = message.toLowerCase()
  return patterns.some(pattern => lower.includes(pattern.toLowerCase()))
}

export async function createPlugin(context: PluginInput, configOverride?: RateLimitFallbackConfig): Promise<Hooks> {
  const config = validateConfig(configOverride ?? loadConfig())
  const logger = createLogger(config.logging)
  const fallbackModels = config.fallbackModels.map(parseModel)

  await logger.info("Plugin initialized", {
    enabled: config.enabled,
    fallbackModels: config.fallbackModels,
    patterns: config.patterns,
    fallbackOnAllErrors: config.fallbackOnAllErrors,
    maxRetries: config.maxRetries,
  })

  if (!config.enabled) {
    await logger.info("Plugin disabled via config")
    return {}
  }

  return {
    event: async ({ event }) => {
      // Clean up state for deleted sessions
      if (event.type === "session.deleted") {
        const props = event.properties as { info?: { id?: string } }
        if (props.info?.id) {
          sessions.delete(props.info.id)
          await logger.info("Session cleaned up", { sessionID: props.info.id })
        }
        return
      }

      const isRetryEvent = event.type === "session.status"
      const isGenericErrorEvent = event.type === "session.error"

      // Skip if not enabled for this event type
      if (!config.fallbackOnAllErrors && !isRetryEvent) return
      if (config.fallbackOnAllErrors && !isRetryEvent && !isGenericErrorEvent) return

      // For retry events, check if it's actually a retry type
      if (isRetryEvent) {
        const props = event.properties as {
          sessionID: string
          status: {
            type: "idle" | "retry" | "busy"
            attempt?: number
            message?: string
            next?: number
          }
        }

        // Only process actual retry types
        if (props.status.type !== "retry" || !props.status.message) return

        // Check if message matches our patterns
        if (!isRateLimitMessage(props.status.message, config.patterns)) return

        await processFallback({
          sessionID: props.sessionID,
          message: props.status.message,
          config,
          fallbackModels,
          logger,
          context,
        })
      } else if (config.fallbackOnAllErrors && isGenericErrorEvent) {
        const props = event.properties as {
          sessionID: string
          error?: { message?: string }
        }

        await processFallback({
          sessionID: props.sessionID,
          message: props.error?.message || "Unknown error",
          config,
          fallbackModels,
          logger,
          context,
        })
      }
    },
  }
}

// Extracted fallback processing function
async function processFallback(params: {
  sessionID: string
  message: string
  config: RateLimitFallbackConfig
  fallbackModels: FallbackModelObject[]
  logger: ReturnType<typeof createLogger>
  context: PluginInput
}) {
  const { sessionID, message, config, fallbackModels, logger, context } = params

  const existing = sessions.get(sessionID)
  if (existing?.inflight) {
    await logger.info("Fallback already in progress, ignoring retry", { sessionID })
    return
  }

  const currentIndex = existing?.index ?? -1
  const nextIndex = currentIndex + 1

  // Check if we've exceeded max retries
  if ((existing?.retries ?? 0) >= config.maxRetries) {
    await logger.info("Max retries exceeded, no more fallbacks allowed", { sessionID })
    try {
      await context.client.tui.showToast({
        body: { message: `Max fallback attempts (${config.maxRetries}) exceeded`, variant: "error" },
      })
    } catch {}
    return
  }

  // Check if we've exhausted the fallback models list
  if (nextIndex >= fallbackModels.length) {
    await logger.info("All fallback models exhausted, no more models to try", { sessionID })
    try {
      await context.client.tui.showToast({
        body: { message: "All fallback models exhausted — no more models to try", variant: "error" },
      })
    } catch {}
    return
  }

  const model = fallbackModels[nextIndex]
  sessions.set(sessionID, { ...existing, inflight: true, start: existing?.start ?? Date.now() } as SessionState)

  const reason = message.split("\n")[0].split(".")[0].substring(0, 80)
  const fromLabel = currentIndex < 0 ? "?" : config.fallbackModels[currentIndex]
  await logger.info(
    `Rate limit hit: ${fromLabel} → ${config.fallbackModels[nextIndex]}`,
    { sessionID, reason }
  )

  try {
    await context.client.session.abort({ path: { id: sessionID } })
    await new Promise(r => setTimeout(r, 200))
    const messagesResponse = await context.client.session.messages({ path: { id: sessionID } })
    const messages = messagesResponse.data as MessageWithParts[] | undefined

    if (!messages || messages.length === 0) {
      await logger.error("No messages found in session", { sessionID })
      return
    }

    const lastUserMessage = [...messages].reverse().find(m => m.info.role === "user")
    if (!lastUserMessage) {
      await logger.error("No user message found in session", { sessionID })
      return
    }

    const originalParts = lastUserMessage.parts.flatMap(p => {
      if (p.synthetic === true) return []
      const converted = convertToPromptPart(p)
      return converted ? [converted] : []
    })

    if (originalParts.length === 0) {
      await logger.error("No valid parts found in user message", { sessionID })
      return
    }

    await context.client.session.revert({
      path: { id: sessionID },
      body: { messageID: lastUserMessage.info.id },
    })
    await new Promise(r => setTimeout(r, 500))

    await context.client.session.prompt({
      path: { id: sessionID },
      body: {
        model,
        agent: lastUserMessage.info.agent,
        parts: originalParts,
      },
    })

    const state = sessions.get(sessionID)
    if (state) {
      sessions.set(sessionID, {
        ...state,
        index: nextIndex,
        inflight: false,
        retries: state.retries ?? 0,  // retries incremented in finally
        queue: [...(state.queue ?? []), nextIndex]
      })
    }

    await logger.info("Fallback prompt sent successfully", { sessionID, index: nextIndex })

    try {
      await context.client.tui.showToast({
        body: {
          message: `Rate limit hit — switched to ${config.fallbackModels[nextIndex]}`,
          variant: "error",
        },
      })
    } catch {}
  } catch (err) {
    await logger.error("Failed to send fallback prompt", {
      sessionID,
      error: err instanceof Error ? err.message : String(err),
    })
  } finally {
    const state = sessions.get(sessionID)
    if (state) {
      // Only update retries and clear inflight; index already updated in try on success
      // Failure leaves index at pre-try value (set in try's initial session set)
      const preTryIndex = existing?.index ?? -1
      const isSuccess = state.index === nextIndex
      sessions.set(sessionID, {
        ...state,
        index: isSuccess ? nextIndex : preTryIndex,
        inflight: false,
        retries: (state.retries ?? 0) + 1,
        queue: [...(state.queue ?? []), isSuccess ? nextIndex : preTryIndex]
      })
    }
  }
}

type PromptPart = { type: "text"; text: string }

function convertToPromptPart(part: MessagePart): PromptPart | null {
  return part.type === "text" && part.text ? { type: "text", text: part.text } : null
}
