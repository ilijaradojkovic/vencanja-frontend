import { Hono } from 'hono';

import { env } from '../env.ts';
import { errorBody, type AppEnv } from '../http.ts';
import { registry } from '../metrics.ts';

/**
 * `GET /api/metrics` — Prometheus scrape endpoint (LOCAL_DEVELOPMENT.md §6).
 *
 * Disabled (`404`) unless `METRICS_ENABLED=true`, which is local-only by default,
 * and always token-protected: without a matching `Bearer METRICS_TOKEN` it answers
 * `401`, and a missing token is treated as a server misconfiguration (`503`)
 * rather than an open endpoint.
 */
export const metricsRoutes = new Hono<AppEnv>().get('/metrics', async (c) => {
  if (!env.metricsEnabled()) return c.json(errorBody(c, 'notFound'), 404);

  const token = env.metricsToken();
  if (!token) return c.json(errorBody(c, 'internalError'), 503);
  if (c.req.header('authorization') !== `Bearer ${token}`) {
    return c.json(errorBody(c, 'unauthorized'), 401);
  }

  return c.body(await registry.metrics(), 200, {
    'content-type': registry.contentType,
    'cache-control': 'no-store',
  });
});
