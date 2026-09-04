# OpenCode Multi-Model Fallback Plugin

OpenCode plugin that automatically switches through a hierarchy of fallback models when rate limits are hit.

## Quickstart

### Install via GitHub Packages (recommended)
```bash
npm install @aldo-f/opencode-multi-model-fallback
# or
bun add @aldo-f/opencode-multi-model-fallback
```

Add to your `opencode.jsonc`:
```json
{
  "plugin": ["opencode-multi-model-fallback"]
}
```

### Auto-config — first run
```bash
opencode-multi-model-fallback configure
```

Or manually create config:
```json
{
  "enabled": true,
  "fallbackModels": ["openrouter/free"],
  "patterns": ["rate limit", "usage limit", "too many requests", "quota exceeded", "overloaded", "capacity exceeded"],
  "logging": true
}
```

Log file: `~/.local/share/opencode/logs/rate-limit-fallback.log`

## Installation Methods

### 1. GitHub Packages (npm/bun) ✅
```bash
npm install @aldo-f/opencode-multi-model-fallback
# or
bun add @aldo-f/opencode-multi-model-fallback
```

**opencode.jsonc:**
```json
{
  "plugin": ["opencode-multi-model-fallback"]
}
```

### 2. Bun Registry
```bash
bun add @aldo-f/opencode-multi-model-fallback
```

### 3. JSR (jsr.io)
```bash
npx jsr add @aldo-f/opencode-multi-model-fallback
```

**Import:**
```typescript
import { createPlugin } from "jsr:@aldo-f/opencode-multi-model-fallback"
```

### 4. Direct CDN (GitHub Raw) — No install needed
```json
{
  "plugin": [
    "https://raw.githubusercontent.com/Aldo-f/opencode-multi-model-fallback/main/index.ts"
  ]
}
```

### 5. Local Development
```json
{
  "plugin": [
    "file:///home/aldo/dev/06-apps-opencode-multi-model-fallback/index.ts"
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

## Auto-Config Wizard

First-time users can run:
```bash
opencode-multi-model-fallback configure
```

This will:
1. Check for existing config
2. Create `~/.config/opencode/rate-limit-fallback-multi.json` with sensible defaults if none exists
3. Set `logging: true` and `fallbackModels: ["openrouter/free"]` by default
4. Print the generated config and log file location

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

## Logging

When `logging: true`, structured log entries are written to:

```
~/.local/share/opencode/logs/rate-limit-fallback.log
```

Example log output:
```
2026-09-04T08:50:23.185Z [INFO] Rate limit hit: ? → openrouter/free {"sessionID":"ses_f94636de4ffe4i7UMTZBAcvO5m","reason":"[Poolside] poolside/laguna-s-2"}
2026-07-24T23:27:15.815Z [INFO] Rate limit hit: opencode-go/deepseek-v4-flash → opencode/laguna-s-2.1-free {"reason":"weekly usage limit reached"}
2026-07-24T23:27:16.828Z [INFO] Rate limit hit: opencode/laguna-s-2.1-free → opencode/deepseek-v4-flash-free {"reason":"Provider rate limit exceeded"}
2026-07-24T23:27:28.062Z [INFO] Fallback settled: opencode/deepseek-v4-flash-free (2 fallbacks in 12647ms)
```

### Multi-channel logging
- **File log**: `~/.local/share/opencode/logs/rate-limit-fallback.log`
- **App log**: `opencode app log` — Warn-level entries
- **Toast**: Error toast in the TUI for immediate feedback

## Publishing & Distribution

### GitHub Packages (npm/bun)
```bash
npm run publish:github
# Install: npm install @aldo-f/opencode-multi-model-fallback
```

**Authentication** (one-time):
```bash
echo "//npm.pkg.github.com/:_authToken=$(gh auth token)" >> ~/.npmrc
```

### Bun Registry
```bash
npm run publish:bun
# Install: bun add @aldo-f/opencode-multi-model-fallback
```

### JSR
```bash
npm run publish:jsr
# Import: import { createPlugin } from "jsr:@aldo-f/opencode-multi-model-fallback"
```

### CI/CD Pipeline
See `.github/workflows/publish.yml` — auto-publishes on version tags.

### Version bumping
```bash
npm version patch  # 0.3.2 → 0.3.3
git push --tags origin main
```

## Local Development

Use a `file://` URL in your opencode.jsonc config:
```json
{
  "plugin": [
    "file:///path/to/opencode-multi-model-fallback/index.ts"
  ]
}
```

## How It Works

1. **Detection**: Listens for `session.status` events with retry messages matching configured patterns
2. **Fallback chain**: When a rate limit is detected, the plugin aborts the current retry, reverts the session to before the last user message, and re-sends it with the next model in the `fallbackModels` list
3. **Linear progression**: Each session independently walks forward through the list. If a session hits rate limits on models 0, 1, and 2, it will try 0 → 1 → 2 → then stop (exhausted). The list is never scanned backward
4. **Per-session tracking**: The plugin tracks which index each session is on. A new session starts from its original model and only enters the fallback chain if it hits a rate limit
5. **Visual feedback**: When the response arrives, the fallback chain is displayed at the top of the AI's response with `[← Rate limit hit: switched to ...]` lines
6. **Multi-channel logging**: File, app, and toast notifications

## License

MIT

## Authors & Contributors

**Maintainer:** Aldo (`Aldo-f`)

**Forked from original by:**
- Liam Vinberg (`vinberg.liam@gmail.com`) — original `opencode-rate-limit-fallback`
- StoreBoughtKibbles (`https://github.com/StoreBoughtKibbles`) — `opencode-rate-limit-fallback-multi`

**Contributors (auto-detected from git):**
- Aldo (`aldo.fieuw@gmail.com`)
- Andrew (`andrew.sd.lee@live.com`)

**Maintainer (this fork):**
- Aldo (`Aldo-f`)