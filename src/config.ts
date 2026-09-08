import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface FallbackModelObject {
  providerID: string;
  modelID: string;
}

export type FallbackModel = string | FallbackModelObject;

export interface RateLimitFallbackConfig {
  enabled: boolean;
  fallbackModels: FallbackModel[];
  patterns: string[];
  logging: boolean;
  fallbackOnAllErrors?: boolean;
  maxRetries: number;
}

export interface RawConfig {
  enabled?: boolean;
  fallbackModels?: FallbackModel[];
  patterns?: string[];
  logging?: boolean;
  fallbackOnAllErrors?: boolean;
  maxRetries?: number;
}

const DEFAULT_PATTERNS = [
  'rate limit',
  'usage limit',
  'too many requests',
  'quota exceeded',
  'overloaded',
  'cannot connect to api',
  'socket connection was closed unexpectedly',
  'socket hang up',
  'econnreset',
  'fetch failed',
  'connection refused',
  'network error',
];

const CONFIG_FILENAME = 'rate-limit-fallback-multi.json';

function getConfigDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'opencode');
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(xdgConfig, 'opencode');
}

function findConfigFile(): string | null {
  const configDir = getConfigDir();
  const rootPath = join(configDir, CONFIG_FILENAME);
  return existsSync(rootPath) ? rootPath : null;
}

function isValidFallbackModel(m: unknown): m is FallbackModel {
  if (typeof m === 'string') return m.length > 0;
  if (typeof m === 'object' && m !== null) {
    const obj = m as Record<string, unknown>;
    return (
      typeof obj.providerID === 'string' &&
      obj.providerID.length > 0 &&
      typeof obj.modelID === 'string' &&
      obj.modelID.length > 0
    );
  }
  return false;
}

export function validateConfig(raw: RawConfig): RateLimitFallbackConfig {
  return {
    enabled: raw.enabled ?? true,
    fallbackModels: Array.isArray(raw.fallbackModels)
      ? raw.fallbackModels.filter(isValidFallbackModel)
      : [],
    patterns: Array.isArray(raw.patterns)
      ? raw.patterns.filter((p) => typeof p === 'string' && p.length > 0)
      : DEFAULT_PATTERNS,
    logging: raw.logging ?? false,
    fallbackOnAllErrors: raw.fallbackOnAllErrors ?? false,
    maxRetries: typeof raw.maxRetries === 'number' && raw.maxRetries > 0 ? raw.maxRetries : 3,
  };
}

export function parseModel(model: FallbackModel): FallbackModelObject {
  if (typeof model === 'object') return model;
  const slashIndex = model.indexOf('/');
  if (slashIndex === -1) return { providerID: model, modelID: model };
  return {
    providerID: model.substring(0, slashIndex),
    modelID: model.substring(slashIndex + 1),
  };
}

export function loadConfig(): RateLimitFallbackConfig {
  const configPath = findConfigFile();
  if (!configPath) {
    return {
      enabled: true,
      fallbackModels: [],
      patterns: DEFAULT_PATTERNS,
      logging: false,
      fallbackOnAllErrors: false,
      maxRetries: 3,
    };
  }
  try {
    const content = readFileSync(configPath, 'utf-8');
    return validateConfig(JSON.parse(content) as RawConfig);
  } catch {
    return {
      enabled: true,
      fallbackModels: [],
      patterns: DEFAULT_PATTERNS,
      logging: false,
      fallbackOnAllErrors: false,
      maxRetries: 3,
    };
  }
}
