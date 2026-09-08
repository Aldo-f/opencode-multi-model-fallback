import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { loadConfig, parseModel, validateConfig, type RateLimitFallbackConfig } from "./config"
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
  })

  if (!config.enabled) {
    await logger.info("Plugin disabled via config")
    return {}
  }

  return {
    event: async ({ event }) => {
      if (event.type === "session.deleted") {
        const props = event.properties as { info?: { id?: string } }
        if (props.info?.id) {
          sessions.delete(props.info.id)
          await logger.info("Session cleaned up", { sessionID: props.info.id })
        }
        return
      }

      if (event.type !== "session.status") return

      const props = event.properties as {
        sessionID: string
        status: {
          type: "idle" | "retry" | "busy"
          attempt?: number
          message?: string
          next?: number
        }
      }

      if (props.status.type !== "retry" || !props.status.message) return
      if (!isRateLimitMessage(props.status.message, config.patterns)) return

      const sessionID = props.sessionID

      const existing = sessions.get(sessionID)
      if (existing?.inflight) {
        await logger.info("Fallback already in progress, ignoring retry", { sessionID })
        return
      }

      const currentIndex = existing?.index ?? -1
      const nextIndex = currentIndex + 1

      if (nextIndex >= fallbackModels.length) {
        await logger.info("All fallbacks exhausted, no more models to try", { sessionID })
        try {
          await context.client.tui.showToast({
            body: { message: "All fallback models exhausted — no more models to try", variant: "error" },
          })
        } catch {}
        return
      }

      const model = fallbackModels[nextIndex]
      sessions.set(sessionID, { ...existing, inflight: true, start: existing?.start ?? Date.now() } as SessionState)

      const reason = props.status.message.split("\n")[0].split(".")[0].substring(0, 80)
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
          sessions.set(sessionID, { ...state, inflight: false })
        }
      }
    },
  }
}

type PromptPart = { type: "text"; text: string }

function convertToPromptPart(part: MessagePart): PromptPart | null {
  return part.type === "text" && part.text ? { type: "text", text: part.text } : null
}