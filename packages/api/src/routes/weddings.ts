import { Hono } from 'hono';

import { errorBody, type AppEnv } from '../http.ts';
import { findEventForOwner, toWeddingPayload } from '../services/events.ts';

/**
 * `GET /api/weddings/current` — the organizer's event (SPEC §6.1, one event per
 * account). Runs behind the onboarding guard, so a profile without a finished
 * onboarding is answered with `409 onboardingRequired` before this handler.
 */
export const weddingRoutes = new Hono<AppEnv>().get('/weddings/current', async (c) => {
  const profile = c.get('profile');
  if (!profile) return c.json(errorBody(c, 'unauthorized'), 401);

  const event = await findEventForOwner(profile.id);
  if (!event) return c.json(errorBody(c, 'weddingNotFound'), 404);
  return c.json({ wedding: toWeddingPayload(event) });
});
