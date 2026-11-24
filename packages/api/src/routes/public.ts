import { Hono, type Context } from 'hono';

import { errorBody, type AppEnv } from '../http.ts';
import {
  addPhotoSubscriber,
  applyPublicRsvp,
  eventById,
  eventBySlug,
  guestByToken,
  markInvitationOpened,
  publicGalleryFor,
  setGuestNotify,
  toPublicGuest,
  toPublicWedding,
} from '../services/public.ts';
import type { EventRow } from '../services/events.ts';
import type { GuestRow } from '../services/guests.ts';

const guestOr404 = async (c: Context<AppEnv>): Promise<GuestRow | Response> => {
  const guest = await guestByToken(c.req.param('token') ?? '');
  if (!guest) return c.json(errorBody(c, 'invitationNotFound'), 404);
  const event = await eventById(guest.eventId);
  if (!event) return c.json(errorBody(c, 'invitationNotFound'), 404);
  return guest;
};

const eventOr404 = async (c: Context<AppEnv>): Promise<EventRow | Response> => {
  const event = await eventBySlug(c.req.param('slug') ?? '');
  return event ?? c.json(errorBody(c, 'weddingNotFound'), 404);
};

const isResponse = (value: GuestRow | EventRow | Response): value is Response => value instanceof Response;

/**
 * Public guest endpoints (API.md, UC-58 – UC-69): invitation, first `opened`,
 * RSVP, "notify me", the public wedding by slug and the gallery with the
 * Europe/Belgrade opening rules. No `Authorization` header is involved; these
 * bodies never contain the guest list, organizer contact data or signed URLs.
 */
export const publicRoutes = new Hono<AppEnv>()
  .get('/public/invitations/:token', async (c) => {
    const guest = await guestOr404(c);
    if (isResponse(guest)) return guest;
    const event = await eventById(guest.eventId);
    if (!event) return c.json(errorBody(c, 'invitationNotFound'), 404);
    return c.json({ guest: toPublicGuest(guest), wedding: toPublicWedding(event) });
  })
  .post('/public/invitations/:token/opened', async (c) => {
    const guest = await guestOr404(c);
    if (isResponse(guest)) return guest;
    await markInvitationOpened(guest);
    return c.json({ ok: true });
  })
  .post('/public/invitations/:token/rsvp', async (c) => {
    const guest = await guestOr404(c);
    if (isResponse(guest)) return guest;
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const updated = await applyPublicRsvp(guest, body);
    return c.json({
      rsvp: {
        status: updated.rsvpStatus,
        persons: updated.rsvpPersons,
        companions: updated.rsvpCompanions,
        note: updated.rsvpNote,
        respondedAt: updated.respondedAt?.toISOString() ?? null,
      },
    });
  })
  .post('/public/invitations/:token/notify', async (c) => {
    const guest = await guestOr404(c);
    if (isResponse(guest)) return guest;
    const body = (await c.req.json().catch(() => ({}))) as { email?: unknown };
    const notifyEmail = await setGuestNotify(guest, body, c.get('language'));
    return c.json({ notifyEmail });
  })
  .get('/public/invitations/:token/gallery', async (c) => {
    const guest = await guestOr404(c);
    if (isResponse(guest)) return guest;
    const event = await eventById(guest.eventId);
    if (!event) return c.json(errorBody(c, 'invitationNotFound'), 404);
    return c.json({ gallery: await publicGalleryFor(event, c.req.query()) });
  })
  .get('/public/weddings/:slug', async (c) => {
    const event = await eventOr404(c);
    if (isResponse(event)) return event;
    return c.json({ wedding: toPublicWedding(event) });
  })
  .get('/public/weddings/:slug/gallery', async (c) => {
    const event = await eventOr404(c);
    if (isResponse(event)) return event;
    if (!event.settings.galleryViaQr) return c.json(errorBody(c, 'galleryPersonalOnly'), 403);
    return c.json({ gallery: await publicGalleryFor(event, c.req.query()) });
  })
  .post('/public/weddings/:slug/notify', async (c) => {
    const event = await eventOr404(c);
    if (isResponse(event)) return event;
    if (!event.settings.galleryViaQr) return c.json(errorBody(c, 'galleryPersonalOnly'), 403);
    const body = (await c.req.json().catch(() => ({}))) as { email?: unknown; name?: unknown };
    const notifyEmail = await addPhotoSubscriber(event, body, c.get('language'));
    return c.json({ notifyEmail });
  });
