import { traceContext } from './trace-context.js';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[DEPTH_LIMIT]';
  if (typeof value === 'string') return value.replace(/https?:\/\/[^\s]+/g, '[URL]').replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[TOKEN]').slice(0, 1000);
  if (value instanceof Error) return { name: value.name };
  if (Array.isArray(value)) return value.slice(0, 30).map(item => redact(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key, /token|secret|password|authorization|cookie|credential|latitude|longitude|email|audio|payload|private.?key|signed.?url/i.test(key) ? '[REDACTED]' : redact(item, depth + 1)]));
  return value;
}
class Logger {
  private currentLevel = 1;
  constructor(level: LogLevel = 'info') { this.setLevel(level); }
  setLevel(level: LogLevel) { this.currentLevel = levels[level] ?? 1; }
  private write(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown) {
    if (this.currentLevel > levels[level]) return;
    console[level](JSON.stringify({ timestamp: new Date().toISOString(), level, message: redact(message), ...context ? { context: redact({ ...traceContext.getStore(), ...context }) } : {}, ...error ? { error: redact(error) } : {} }));
  }
  debug(message: string, context?: Record<string, unknown>) { this.write('debug',message,context); }
  info(message: string, context?: Record<string, unknown>) { this.write('info',message,context); }
  warn(message: string, context?: Record<string, unknown>) { this.write('warn',message,context); }
  error(message: string, context?: Record<string, unknown>, err?: unknown) { this.write('error',message,context,err); }
}
export const logger = new Logger(process.env.LOG_LEVEL as LogLevel || 'info');
