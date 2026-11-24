import { isRuleViolation } from '@uspomena/shared';
import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

import type { MessageKey, MessageParams } from '@uspomena/shared';

import { errorBody, type AppEnv } from './http.ts';
import { getLogger } from './logger.ts';
import { httpErrorsTotal, normalizeRoute } from './metrics.ts';

/** Maps a framework status to the shared message key shown to the user. */
const STATUS_MESSAGES: Record<number, MessageKey> = {
  400: 'badRequest',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'notFound',
  409: 'conflict',
  422: 'badRequest',
  429: 'tooManyRequests',
};

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) => {
  httpErrorsTotal.inc({ route: normalizeRoute(c.req.routePath), code: 'notFound' });
  return c.json(errorBody(c, 'notFound'), 404);
};

/**
 * Single error path for the API: shared rule violations become `422` with their
 * own message key, framework errors keep their status, and anything else is a
 * logged `500` whose response never exposes internals (SYS-1, D17).
 */
export const errorHandler: ErrorHandler<AppEnv> = (error, c) => {
  const route = normalizeRoute(c.req.routePath);

  if (error instanceof ApiProblem) {
    httpErrorsTotal.inc({ route, code: error.code });
    return c.json(errorBody(c, error.code, error.params), error.status);
  }

  if (isRuleViolation(error)) {
    httpErrorsTotal.inc({ route, code: error.code });
    return c.json(errorBody(c, error.code, error.params), 422);
  }

  if (error instanceof HTTPException) {
    const code = STATUS_MESSAGES[error.status] ?? 'internalError';
    httpErrorsTotal.inc({ route, code });
    return c.json(errorBody(c, code), error.status);
  }

  httpErrorsTotal.inc({ route, code: 'internalError' });
  getLogger().error(
    {
      requestId: c.get('requestId'),
      traceId: c.get('traceId'),
      route,
      err: { name: error.name, message: error.message, stack: error.stack },
    },
    'unhandled error',
  );

  return c.json(errorBody(c, 'internalError'), 500);
};

/**
 * A domain error with an explicit HTTP status and shared message key, for rules
 * that are not input validation (e.g. the storage ceiling's `403 storageLimit`).
 */
export class ApiProblem extends Error {
  constructor(
    readonly status: 403 | 404 | 409 | 422,
    readonly code: MessageKey,
    readonly params: MessageParams = {},
  ) {
    super(code);
    this.name = 'ApiProblem';
  }
}
