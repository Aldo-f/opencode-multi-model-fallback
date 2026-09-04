# opencode-rate-limit-fallback-multi

OpenCode plugin that automatically switches through a hierarchy of fallback models when rate limits are hit.

[![npm version](https://img.shields.io/npm/v/opencode-rate-limit-fallback-multi.svg?style=flat-square)](https://www.npmjs.com/package/opencode-rate-limit-fallback-multi)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

## Quickstart

Install via npm plugin command:

```bash
opencode plugin install opencode-rate-limit-fallback-multi
```

Auto-config — first run automatically creates config with logging enabled:

```bash
opencode-rate-limit-fallback-multi configure
```

Or configure manually:

```json
{
  "enabled": true,
  "fallbackModels": ["openrouter/free"],
  "patterns": ["rate limit", "usage limit", "too many requests", "quota exceeded", "overloaded", "capacity exceeded"],
  "logging": true
}
```

Log file: `~/.local/share/opencode/logs/rate-limit-fallback.log`

## Usage

Primary model with automatic fallback on rate limits:

```json
{
  "model": "freellm/auto"
}
```

When `freellm/auto` hits a rate limit, the plugin will revert to the last user message and resubmit with `openrouter/free` (or configured fallback chain).

### Multiple Fallback Models

```json
{
  "fallbackModels": ["openrouter/free", "poolside/laguna-s-2.1:free", "deepseek/v4-flash-free"]
}
```

## Auto-Config Wizard

First-time users can run:

```bash
opencode-rate-limit-fallback-multi configure
```

This will:

1. Check for existing config
2. Create `~/.config/opencode/rate-limit-fallback-multi.json` with sensible defaults if none exists
3. Set `logging: true` and `fallbackModels: ["openrouter/free"]` by default
4. Print the generated config and log file location

### Customizing the Fallback Chain

Run the wizard and select which providers/models to include, or edit the config file directly:

```bash
opencode-rate-limit-fallback-multi configure
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

## Local Development

Use a `file://` URL in your opencode.jsonc config:

```json
{
  "plugin": [
    "file:///path/to/opencode-rate-limit-fallback-multi/index.ts"
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

## Author

Aldo