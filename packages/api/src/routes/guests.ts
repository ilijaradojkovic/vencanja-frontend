import { Hono } from 'hono';

import { errorBody, type AppEnv } from '../http.ts';
import {
  createGuest,
  deleteGuest,
  importGuests,
  listGuests,
  ownedEventId,
  ownedGuest,
  toGuestPayload,
  updateGuest,
} from '../services/guests.ts';

/**
 * Organizer guest management (API.md, UC-17 – UC-25). Every route runs behind the
 * onboarding guard; the event (or the guest's event) must belong to the organizer,
 * otherwise it is reported as not found.
 */
export const guestRoutes = new Hono<AppEnv>()
  .get('/weddings/:id/guests', async (c) => {
    const profile = c.get('profile');
    if (!profile) return c.json(errorBody(c, 'unauthorized'), 401);
    const eventId = await ownedEventId(profile.id, c.req.param('id'));
    if (!eventId) return c.json(errorBody(c, 'weddingNotFound'), 404);
    return c.json({ guests: (await listGuests(eventId)).map(toGuestPayload) });
  })
  .post('/weddings/:id/guests', async (c) => {
    const profile = c.get('profile');
    if (!profile) return c.json(errorBody(c, 'unauthorized'), 401);
    const eventId = await ownedEventId(profile.id, c.req.param('id'));
    if (!eventId) return c.json(errorBody(c, 'weddingNotFound'), 404);
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    return c.json({ guest: toGuestPayload(await createGuest(eventId, body)) }, 201);
  })
  .post('/weddings/:id/guests/import', async (c) => {
    const profile = c.get('profile');
    if (!profile) return c.json(errorBody(c, 'unauthorized'), 401);
    const eventId = await ownedEventId(profile.id, c.req.param('id'));
    if (!eventId) return c.json(errorBody(c, 'weddingNotFound'), 404);
    const body = (await c.req.json().catch(() => ({}))) as { guests?: unknown };
    const created = await importGuests(eventId, body.guests ?? []);
    return c.json({ guests: created.map(toGuestPayload) }, 201);
  })
  .patch('/guests/:id', async (c) => {
    const profile = c.get('profile');
    if (!profile) return c.json(errorBody(c, 'unauthorized'), 401);
    const guest = await ownedGuest(profile.id, c.req.param('id'));
    if (!guest) return c.json(errorBody(c, 'guestNotFound'), 404);
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    return c.json({ guest: toGuestPayload(await updateGuest(guest.eventId, guest.id, body)) });
  })
  .delete('/guests/:id', async (c) => {
    const profile = c.get('profile');
    if (!profile) return c.json(errorBody(c, 'unauthorized'), 401);
    const guest = await ownedGuest(profile.id, c.req.param('id'));
    if (!guest) return c.json(errorBody(c, 'guestNotFound'), 404);
    await deleteGuest(guest.eventId, guest.id);
    return c.json({ id: guest.id });
  });
