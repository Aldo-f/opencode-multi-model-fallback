#!/usr/bin/env node
// Auto-config wizard: asks for providers, creates rate-limit-fallback-multi.json
import { existsSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const CONFIG_FILE = join(homedir(), ".config", "opencode", "rate-limit-fallback-multi.json")

console.log("=== opencode-multi-model-fallback configure ===")
console.log("Default: logging true, fallbackModels: [openrouter/free]")
console.log("Creating config...\n")

const config = {
  enabled: true,
  fallbackModels: ["openrouter/free"],
  patterns: [
    "rate limit",
    "usage limit",
    "too many requests",
    "quota exceeded",
    "overloaded",
    "capacity exceeded"
  ],
  logging: true
}

try {
  // Ensure directory exists via simple approach
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n")
  console.log("Config written to:", CONFIG_FILE)
  console.log("Log file: ~/.local/share/opencode/logs/rate-limit-fallback.log")
  console.log("Local dev mode: \"plugin\": [\"file://" + process.cwd() + "/index.ts\"]")
} catch (e) {
  console.error("Failed:", e)
  process.exit(1)
}