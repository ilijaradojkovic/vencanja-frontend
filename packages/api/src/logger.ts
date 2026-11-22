import pino, { type Logger, type LoggerOptions } from 'pino';

import { env } from './env.ts';

/**
 * Structured request logs (LOCAL_DEVELOPMENT.md §4). Output is newline-delimited
 * JSON except in local development, where pino-pretty makes it readable.
 *
 * Redaction is part of the contract: authorization/cookie headers and anything
 * that could carry a token, email address or signed URL must never be logged.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-forwarded-for"]',
  'headers.authorization',
  'headers.cookie',
];

let logger: Logger | null = null;

export const getLogger = (): Logger => {
  if (logger) return logger;

  const options: LoggerOptions = {
    level: process.env.LOG_LEVEL?.trim() || 'info',
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  };
  if (!env.isProduction()) {
    options.transport = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    };
  }

  logger = pino(options);
  return logger;
};

/** Local trace files are added with the diagnostics task (LOCAL_DEVELOPMENT.md §5). */
export const resetLoggerForTests = (): void => {
  logger = null;
};
