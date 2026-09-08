import { homedir } from 'node:os';
import { join } from 'node:path';

const LOG_DIR = join(
  process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'),
  'opencode',
  'logs'
);
const LOG_FILE = join(LOG_DIR, 'rate-limit-fallback.log');

let initialized = false;

async function ensureDir(): Promise<void> {
  if (initialized) return;
  const { mkdir } = await import('node:fs/promises');
  await mkdir(LOG_DIR, { recursive: true }).catch(() => {});
  initialized = true;
}

export async function log(
  level: 'INFO' | 'WARN' | 'ERROR',
  message: string,
  extra?: Record<string, unknown>
): Promise<void> {
  await ensureDir();
  const timestamp = new Date().toISOString();
  const extraStr = extra ? ' ' + JSON.stringify(extra) : '';
  const line = `${timestamp} [${level}] ${message}${extraStr}\n`;
  const { appendFile } = await import('node:fs/promises');
  await appendFile(LOG_FILE, line).catch(() => {});
}

export function createLogger(enabled: boolean) {
  if (!enabled) {
    return { info: async () => {}, warn: async () => {}, error: async () => {} };
  }
  return {
    info: (message: string, extra?: Record<string, unknown>) => log('INFO', message, extra),
    warn: (message: string, extra?: Record<string, unknown>) => log('WARN', message, extra),
    error: (message: string, extra?: Record<string, unknown>) => log('ERROR', message, extra),
  };
}
