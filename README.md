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

## Logging

When `logging: true`, structured log entries are written to:
```text
~/.local/share/opencode/logs/rate-limit-fallback.log
```

Example log output:
```
2026-09-04T08:50:23.185Z [INFO] Rate limit hit: ? → openrouter/free {"sessionID":"ses_f94636de4ffe4i7UMTZBAcvO5m","reason":"[Poolside] poolside/laguna-s-2"}
```

## How It Works

1. **Detection**: Listens for `session.status` events with retry messages matching configured patterns
2. **Fallback chain**: When a rate limit is detected, the plugin aborts the current retry, reverts the session to before the last user message, and re-sends it with the next model in the `fallbackModels` list
3. **Linear progression**: Each session independently walks forward through the list. If a session hits rate limits on models 0, 1, and 2, it will try 0 → 1 → 2 → then stop (exhausted)
4. **Per-session tracking**: The plugin tracks which index each session is on
5. **Visual feedback**: When the response arrives, the fallback chain is displayed at the top of the AI's response with `[← Rate limit hit: switched to ...]` lines

## License

MIT