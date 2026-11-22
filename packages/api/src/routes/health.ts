import { Hono } from 'hono';

import { pingDatabase } from '../db/client.ts';
import { env } from '../env.ts';
import type { AppEnv } from '../http.ts';

/**
 * `GET /health` — the local walking-skeleton probe (SPEC §6). It checks the real
 * database connection; a failure answers `503` so the product and CI can tell a
 * broken stack from a healthy one.
 */
export const healthRoutes = new Hono<AppEnv>().get('/health', async (c) => {
  const databaseOk = await pingDatabase();
  return c.json(
    { ok: databaseOk, version: env.version(), db: databaseOk ? ('ok' as const) : ('error' as const) },
    databaseOk ? 200 : 503,
  );
});
