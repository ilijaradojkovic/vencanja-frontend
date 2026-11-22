import type { MiddlewareHandler } from 'hono';

import { errorBody, type AppEnv } from '../http.ts';
import { readBearerToken } from '../services/auth.ts';
import { loadSession } from '../services/profiles.ts';

/** Superadmin-only boundary for every `/admin/*` route (SPEC §6.2). */
export const adminGuard = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const token = readBearerToken(c.req.header('authorization'));
  if (!token) return c.json(errorBody(c, 'unauthorized'), 401);

  const session = await loadSession(token);
  if (!session.ok) return c.json(errorBody(c, session.code), 401);
  if (session.profile.role !== 'superadmin') return c.json(errorBody(c, 'adminOnly'), 403);

  c.set('profile', session.profile);
  await next();
};
