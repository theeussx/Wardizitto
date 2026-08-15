export type LogCategory = 'application' | 'audit' | 'performance' | 'database' | 'api' | 'discord';

export type LogContext = Readonly<Record<string, unknown>>;

export interface AppLogger {
  debug(message: string, context?: LogContext, category?: LogCategory): void;
  info(message: string, context?: LogContext, category?: LogCategory): void;
  warn(message: string, context?: LogContext, category?: LogCategory): void;
  error(message: string, error?: unknown, context?: LogContext, category?: LogCategory): void;
  audit(message: string, context?: LogContext): void;
  performance(message: string, durationMs: number, context?: LogContext): void;
  child(context: LogContext): AppLogger;
}
