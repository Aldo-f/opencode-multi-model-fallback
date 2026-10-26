# opencode-multi-model-fallback

OpenCode plugin that automatically switches through a hierarchy of fallback models when rate limits are hit.

[![GitHub Release](https://img.shields.io/github/v/release/Aldo-f/opencode-multi-model-fallback?style=flat-square)](https://github.com/Aldo-f/opencode-multi-model-fallback/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square)](https://www.typescriptlang.org/)

## Quickstart

### Recommended install via opencode CLI
```bash
opencode plugin @usful/opencode-multi-model-fallback
```

**This automatically:**
- Installs the package from npmjs.com
- Updates your `opencode.jsonc` with the plugin entry
- Sets up local scope configuration

**To add to existing opencode.jsonc:**
```json
{
  "plugin": ["opencode-multi-model-fallback"]
}
```

### Configure the plugin
The plugin creates its config file automatically. You can customize it at:
`~/.config/opencode/rate-limit-fallback-multi.json`

Default config:
```json
{
  "enabled": true,
  "fallbackModels": ["openrouter/free"],
  "patterns": ["rate limit", "usage limit", "too many requests", "quota exceeded", "overloaded", "capacity exceeded"],
  "logging": true
}
```

## Installation Methods

### 1. Recommended: opencode CLI plugin install
```bash
opencode plugin @usful/opencode-multi-model-fallback
```

### 2. npm / bun registry
```bash
npm install @usful/opencode-multi-model-fallback
# or
bun add @usful/opencode-multi-model-fallback
```

### 3. JSR (jsr.io)
```bash
npx jsr add @usful/opencode-multi-model-fallback
```

### 4. Direct GitHub Raw (for local development)
```json
{
  "plugin": [
    "https://raw.githubusercontent.com/Aldo-f/opencode-multi-model-fallback/main/index.ts"
  ]
}
```

## Usage

Primary model with automatic fallback on rate limits:
```json
{
  "model": "freellm/auto"
}
```

When `freellm/auto` hits a rate limit, the plugin reverts to the last user message and resubmits with `openrouter/free` (or configured fallback chain).

### Multiple Fallback Models
```json
{
  "fallbackModels": ["openrouter/free", "poolside/laguna-s-2.1:free", "deepseek/v4-flash-free"]
}
```

## Configuration File

Default location: `~/.config/opencode/rate-limit-fallback-multi.json`

```json
{
  "enabled": true,
  "fallbackModels": ["openrouter/free"],
  "patterns": [
    "rate limit",
    "usage limit",
    "too many requests",
    "quota exceeded",
    "overloaded",
    "capacity exceeded"
  ],
  "logging": true
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable the plugin |
| `fallbackModels` | array | `["openrouter/free"]` | Ordered list of fallback models |
| `patterns` | string[] | see below | Custom rate limit detection patterns |
| `logging` | boolean | `true` | Enable file-based logging |
| `fallbackOnAllErrors` | boolean | `false` | Process generic `session.error` events as fallbacks |
| `maxRetries` | number | `3` | Max number of fallback attempts per session (inclusive) |

## Logging

When `logging: true`, structured log entries are written to:
```text
~/.local/share/opencode/logs/rate-limit-fallback.log
```

Example log output:
```
2026-09-04T08:50:23.185Z [INFO] Rate limit hit: ? → openrouter/free {"sessionID":"ses_f94636de4ffe4i7UMTZBAcvO5m","reason":"[Poolside] poolside/laguna-s-2"}
```

### Multi-channel logging

- **File log**: `~/.local/share/opencode/logs/rate-limit-fallback.log`
- **App log**: `opencode app log` — Warn-level entries
- **Toast**: Error toast in the TUI for immediate feedback

## How It Works

**Flowchart:**
```mermaid
flowchart TD
    A[User sends message to primary model] --> B[Rate limit error detected]
    B --> C{If fallbackModels exhausted?}
    C -- Yes --> D[Log: All fallbacks exhausted + Toast]
    C -- No --> E[Revert to last user message]
    E --> F[Send with next model in chain]
    F --> G[Log: Rate limit hit: modelA → modelB]
    G --> H{Success?}
    H -- Yes --> I[Increment session index]
    H -- No --> J[Reset inflight, increment retries]
    I --> K[Continue with next model]
    J --> L[Retry with same model]
    L --> M{Retry limit reached?}
    M -- Yes --> N[Log: Max retries exceeded + Toast]
    M -- No --> O[Retry with same model]

    subgraph "Configuration"
        P[Config file]
        Q[fallbackModels array]
        R[patterns array]
        S[fallbackOnAllErrors: boolean]
        T[maxRetries: number]
    end
    P --> Q
    P --> R
    P --> S
    P --> T

    %% Session state tracking
    U[SessionState: {index, queue, inflight, start, retries}]
    V[Map<sessionID, SessionState>]

    subgraph "Error detection"
        W[session.status events]
        X[status.type === retry]
        Y[message matches patterns]
        Z[session.error events]
    end
    W --> X --> Y --> E
    Z --> E
```

**Detailed Process:**

1. **Detection**: 
   - On `session.status` events with `status.type === "retry"` and message matching patterns
   - When `fallbackOnAllErrors: true`, also reacts to `session.error` events

2. **Fallback Logic**:
   - Check if `retries` (state) ≥ `maxRetries` → stop (no more attempts)
   - Check if `nextIndex` (state +1) ≥ `fallbackModels.length` → all models exhausted
   - Store new session state with `inflight: true` while sending prompt

3. **Response Handling**:
   - On success: increment `index`, store new session state with `inflight: false`, emit log/toast
   - On failure: emit error log, reset `inflight: false`, increment `retries` count

4. **Session Reset**:
   - When `session.deleted` event fires, plugin removes session from tracking map → next session gets fresh state (`index: -1`, `retries: 0`)
   - No automatic reset on successful completion — user can manually delete session or modify config

## Session State Management

| Field | Purpose | Reset Condition |
|-------|---------|------------------|
| `index` | Current position in fallback chain | Reset to -1 on new session |
| `queue` | History of attempted indices (for debugging) | Accumulates, never cleared |
| `inflight` | Prevents overlapping fallback attempts | Reset to false after attempt |
| `start` | Timestamp when fallback began | Reset on new session |
| `retries` | Number of attempts for current session | Reset to 0 on new session |

## File Locations

- **Config**: `~/.config/opencode/rate-limit-fallback-multi.json`
- **Log file**: `~/.local/share/opencode/logs/rate-limit-fallback.log`
- **Plugin registration**: `opencode.jsonc` (user home directory)
- **Plugin source**: `index.ts` or `file:///path/to/opencode-multi-model-fallback/index.ts`

## Publishing & Distribution

### GitHub Packages (npm/bun)
```bash
# Publish
npm run publish:github

# Install
npm install @usful/opencode-multi-model-fallback
# or
bun add @usful/opencode-multi-model-fallback
```

**Authentication** (one-time):
```bash
echo "//npm.pkg.github.com/:_authToken=$(gh auth token)" >> ~/.npmrc
```

### Bun Registry
```bash
npm run publish:bun
# Install: bun add @usful/opencode-multi-model-fallback
```

### JSR
```bash
npm run publish:jsr
# Import: import { createPlugin } from "jsr:@usful/opencode-multi-model-fallback"
```

### CI/CD Pipeline
See `.github/workflows/publish.yml` — auto-publishes on version tags.

### Version bumping
```bash
npm version patch  # 0.3.2 → 0.3.3
git push --tags origin main
```

## License

MIT