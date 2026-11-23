import { isValidSlug, RuleViolation } from '@uspomena/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { getDb } from '../db/client.ts';
import { events } from '../db/schema.ts';
import { errorBody, type AppEnv } from '../http.ts';
import { findEventForOwner, purgeAtFor, slugTakenByOther, toWeddingPayload } from '../services/events.ts';
import { parseWeddingPatch } from '../services/weddings.ts';

/**
 * `GET /api/weddings/current` — the organizer's event (SPEC §6.1, one event per
 * account). Runs behind the onboarding guard, so a profile without a finished
 * onboarding is answered with `409 onboardingRequired` before this handler.
 *
 * `PATCH /api/weddings/:id` — partial update with the SPEC §6.6 validation: a
 * unique slug, known invitation fields (11 templates, `#RRGGBB`, ≤20 schedule
 * items with `HH:mm`) and known settings only. A foreign or unknown id answers
 * `404 weddingNotFound` so ownership is not disclosed; `purge_at` follows a date
 * change (SYS-9).
 */
export const weddingRoutes = new Hono<AppEnv>()
  .get('/weddings/current', async (c) => {
    const profile = c.get('profile');
    if (!profile) return c.json(errorBody(c, 'unauthorized'), 401);

    const event = await findEventForOwner(profile.id);
    if (!event) return c.json(errorBody(c, 'weddingNotFound'), 404);
    return c.json({ wedding: toWeddingPayload(event) });
  })
  .patch('/weddings/:id', async (c) => {
    const profile = c.get('profile');
    if (!profile) return c.json(errorBody(c, 'unauthorized'), 401);

    const [event] = await getDb()
      .select()
      .from(events)
      .where(eq(events.id, c.req.param('id')))
      .limit(1);
    if (!event || event.ownerId !== profile.id) return c.json(errorBody(c, 'weddingNotFound'), 404);

    const body = (await c.req.json().catch(() => null)) as unknown;
    const patch = parseWeddingPatch(event, body);

    if (patch.slug !== undefined) {
      if (!isValidSlug(patch.slug)) throw new RuleViolation('badSlug');
      if (await slugTakenByOther(patch.slug, event.id)) throw new RuleViolation('badSlug');
    }

    const [updated] = await getDb()
      .update(events)
      .set({
        ...patch,
        ...(patch.date !== undefined && patch.date !== event.date
          ? { purgeAt: purgeAtFor(patch.date, event.retentionMonths) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(events.id, event.id))
      .returning();
    if (!updated) return c.json(errorBody(c, 'internalError'), 500);

    return c.json({ wedding: toWeddingPayload(updated) });
  });
