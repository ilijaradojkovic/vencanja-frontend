import type { MiddlewareHandler } from 'hono';

import { errorBody, type AppEnv } from '../http.ts';
import { readBearerToken } from '../services/auth.ts';
import { loadSession } from '../services/profiles.ts';

/**
 * Authorization boundary for the organizer's data routes (SPEC §6.1): a missing
 * or invalid token answers `401`, and a profile that has not finished onboarding
 * answers `409 onboardingRequired`. The Next.js proxy redirects are UX only; this
 * guard is what actually protects `/weddings`, `/guests` and `/photos`.
 */
export const onboardingGuard = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const token = readBearerToken(c.req.header('authorization'));
  if (!token) return c.json(errorBody(c, 'unauthorized'), 401);

  const session = await loadSession(token);
  if (!session.ok) return c.json(errorBody(c, session.code), 401);
  if (!session.profile.onboardedAt) return c.json(errorBody(c, 'onboardingRequired'), 409);

  c.set('profile', session.profile);
  await next();
};
