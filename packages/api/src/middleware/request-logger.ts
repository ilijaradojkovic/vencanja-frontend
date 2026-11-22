import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../http.ts';
import { getLogger } from '../logger.ts';

/**
 * Emits one redacted, correlated log line per request (LOCAL_DEVELOPMENT.md §4):
 * timestamp, level, request/trace IDs, method, normalized route template, status
 * and duration. Raw paths (invitation tokens) are never logged.
 */
export const requestLogger = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  await next();

  getLogger().info(
    {
      requestId: c.get('requestId'),
      traceId: c.get('traceId'),
      spanId: c.get('spanId'),
      parentSpanId: c.get('parentSpanId'),
      method: c.req.method,
      route: c.req.routePath,
      status: c.res.status,
      durationMs: Date.now() - c.get('startedAt'),
    },
    'request',
  );
};
