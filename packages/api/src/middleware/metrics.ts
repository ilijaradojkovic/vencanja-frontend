import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../http.ts';
import { httpRequestDurationSeconds, httpRequestsTotal, normalizeRoute } from '../metrics.ts';

/** Records the request count and duration with bounded labels (LOCAL_DEVELOPMENT.md §6). */
export const metricsMiddleware = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  await next();

  const method = c.req.method;
  const route = normalizeRoute(c.req.routePath);
  httpRequestsTotal.inc({ method, route, status: String(c.res.status) });
  httpRequestDurationSeconds.observe({ method, route }, (Date.now() - c.get('startedAt')) / 1000);
};
