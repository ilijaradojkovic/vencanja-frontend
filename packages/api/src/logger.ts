import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import pretty from 'pino-pretty';

import { diagnosticsEnabled, diagnosticsStream } from './diagnostics/store.ts';
import { env } from './env.ts';

/**
 * Structured request logs (LOCAL_DEVELOPMENT.md §4). Output is newline-delimited
 * JSON except in local development, where pino-pretty makes it readable.
 *
 * Redaction is part of the contract: authorization/cookie headers and anything
 * that could carry a token, email address or signed URL must never be logged.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-forwarded-for"]',
  'headers.authorization',
  'headers.cookie',
  'authorization',
  'token',
];

export const createLogger = (destination?: DestinationStream): Logger => {
  const options: LoggerOptions = {
    level: process.env.LOG_LEVEL?.trim() || 'info',
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  };

  if (destination) return pino(options, destination);

  // Local tester diagnostics mirror the same records to bounded JSONL files
  // (LOCAL_DEVELOPMENT.md §5) while keeping the readable console output.
  if (diagnosticsEnabled()) {
    return pino(
      options,
      pino.multistream([
        { stream: pretty({ colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' }) },
        { stream: diagnosticsStream() },
      ]),
    );
  }

  if (!env.isProduction()) {
    options.transport = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    };
  }
  return pino(options);
};

let logger: Logger | null = null;

export const getLogger = (): Logger => {
  if (!logger) logger = createLogger();
  return logger;
};

/** Local trace files are added with the diagnostics task (LOCAL_DEVELOPMENT.md §5). */
export const resetLoggerForTests = (): void => {
  logger = null;
};
