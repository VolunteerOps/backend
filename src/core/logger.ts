export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private currentLevel: number = 1;

  constructor(level: LogLevel = 'info') {
    this.setLevel(level);
  }

  setLevel(level: LogLevel) {
    this.currentLevel = levels[level] ?? 1;
  }

  private format(level: LogLevel, message: string, context?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const ctxStr = context && Object.keys(context).length > 0 ? ` | context: ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [VolunteerOps-API]: ${message}${ctxStr}`;
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (this.currentLevel <= levels.debug) {
      console.debug('\x1b[90m' + this.format('debug', message, context) + '\x1b[0m');
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    if (this.currentLevel <= levels.info) {
      console.info('\x1b[36m' + this.format('info', message, context) + '\x1b[0m');
    }
  }

  warn(message: string, context?: Record<string, unknown>) {
    if (this.currentLevel <= levels.warn) {
      console.warn('\x1b[33m' + this.format('warn', message, context) + '\x1b[0m');
    }
  }

  error(message: string, context?: Record<string, unknown>, err?: unknown) {
    if (this.currentLevel <= levels.error) {
      console.error('\x1b[31m' + this.format('error', message, context) + '\x1b[0m');
      if (err) {
        console.error(err);
      }
    }
  }
}

export const logger = new Logger(process.env.LOG_LEVEL as LogLevel || 'info');
