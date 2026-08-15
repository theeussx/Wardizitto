import fs from 'node:fs';
import path from 'node:path';

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import type { Format, TransformableInfo } from 'logform';

import type { AppLogger, LogCategory, LogContext } from '../../application/ports/logger.js';

interface SerializedError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly code?: unknown;
}

const serializeError = (error: unknown): unknown => {
  if (!(error instanceof Error)) return error;
  const serialized: SerializedError = {
    name: error.name,
    message: error.message,
    ...(error.stack === undefined ? {} : { stack: error.stack }),
    ...('code' in error ? { code: error.code } : {}),
  };
  return serialized;
};

const exactLevel = (level: string): Format =>
  winston.format((info: TransformableInfo) => (info.level === level ? info : false))();

const exactCategory = (category: LogCategory): Format =>
  winston.format((info: TransformableInfo) => (info.category === category ? info : false))();

const applicationCategory = winston.format((info: TransformableInfo) =>
  info.category === undefined || info.category === 'application' ? info : false,
)();

const createRotatingTransport = (
  directory: string,
  filename: string,
  retentionDays: number,
  filter: Format,
): DailyRotateFile =>
  new DailyRotateFile({
    dirname: directory,
    filename: `${filename}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: `${String(retentionDays)}d`,
    format: winston.format.combine(filter, winston.format.timestamp(), winston.format.json()),
  });

class WinstonLogger implements AppLogger {
  public constructor(
    private readonly logger: winston.Logger,
    private readonly baseContext: LogContext = {},
  ) {}

  public debug(
    message: string,
    context: LogContext = {},
    category: LogCategory = 'application',
  ): void {
    this.logger.debug(message, { ...this.baseContext, ...context, category });
  }

  public info(
    message: string,
    context: LogContext = {},
    category: LogCategory = 'application',
  ): void {
    this.logger.info(message, { ...this.baseContext, ...context, category });
  }

  public warn(
    message: string,
    context: LogContext = {},
    category: LogCategory = 'application',
  ): void {
    this.logger.warn(message, { ...this.baseContext, ...context, category });
  }

  public error(
    message: string,
    error?: unknown,
    context: LogContext = {},
    category: LogCategory = 'application',
  ): void {
    this.logger.error(message, {
      ...this.baseContext,
      ...context,
      category,
      ...(error === undefined ? {} : { error: serializeError(error) }),
    });
  }

  public audit(message: string, context: LogContext = {}): void {
    this.info(message, context, 'audit');
  }

  public performance(message: string, durationMs: number, context: LogContext = {}): void {
    this.info(message, { ...context, durationMs }, 'performance');
  }

  public child(context: LogContext): AppLogger {
    return new WinstonLogger(this.logger, { ...this.baseContext, ...context });
  }
}

export interface LoggerOptions {
  readonly level: string;
  readonly directory: string;
  readonly retentionDays: number;
  readonly production: boolean;
}

export const createLogger = (options: LoggerOptions): AppLogger => {
  const directory = path.resolve(options.directory);
  fs.mkdirSync(directory, { recursive: true });

  const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, category, ...metadata }) => {
      const suffix = Object.keys(metadata).length === 0 ? '' : ` ${JSON.stringify(metadata)}`;
      const categoryName = typeof category === 'string' ? category : 'application';
      return `${String(timestamp)} [${categoryName}] ${level}: ${String(message)}${suffix}`;
    }),
  );

  const transports: winston.transport[] = [
    new winston.transports.Console({ format: consoleFormat }),
    createRotatingTransport(directory, 'error', options.retentionDays, exactLevel('error')),
    createRotatingTransport(directory, 'warning', options.retentionDays, exactLevel('warn')),
    createRotatingTransport(
      directory,
      'info',
      options.retentionDays,
      winston.format.combine(exactLevel('info'), applicationCategory),
    ),
    createRotatingTransport(directory, 'debug', options.retentionDays, exactLevel('debug')),
    ...(['audit', 'performance', 'database', 'api', 'discord'] as const).map((category) =>
      createRotatingTransport(directory, category, options.retentionDays, exactCategory(category)),
    ),
  ];

  const logger = winston.createLogger({
    level: options.level,
    defaultMeta: { service: 'wardizitto', version: '2.0.0' },
    transports,
    exitOnError: false,
  });

  for (const transport of transports) {
    transport.on('error', (error: Error) => {
      process.stderr.write(`[logger] ${error.message}\n`);
    });
  }

  return new WinstonLogger(logger);
};
