import {
  galleryOpensAt,
  isEmail,
  isGalleryOpen,
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  parseRsvp,
  RuleViolation,
  type Language,
} from '@uspomena/shared';
import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '../db/client.ts';
import { events, guests, photoSubscribers, photos } from '../db/schema.ts';
import type { EventRow } from './events.ts';
import type { GuestRow } from './guests.ts';

export type PublicWedding = {
  type: 'wedding' | 'celebration';
  occasion: string;
  slug: string;
  partner1: string;
  partner2: string;
  date: string;
  rsvpDeadline: string | null;
  city: string;
  invitation: EventRow['invitation'];
  settings: { allowGeneralUpload: boolean };
  gallery: { open: boolean; mode: EventRow['settings']['galleryOpen']; opensAt: string | null; viaQr: boolean };
};

/** Everything a guest may see about the event; no organizer contact data or guest list (API.md). */
export const toPublicWedding = (event: EventRow, now: Date = new Date()): PublicWedding => ({
  type: event.type,
  occasion: event.occasion,
  slug: event.slug,
  partner1: event.partner1,
  partner2: event.partner2,
  date: event.date,
  rsvpDeadline: event.rsvpDeadline ?? null,
  city: event.city,
  invitation: event.invitation,
  settings: { allowGeneralUpload: event.settings.allowGeneralUpload },
  gallery: {
    open: isGalleryOpen(event, now),
    mode: event.settings.galleryOpen,
    opensAt: galleryOpensAt(event),
    viaQr: Boolean(event.settings.galleryViaQr),
  },
});

export type PublicGuest = {
  name: string;
  token: string;
  maxPersons: number;
  companions: GuestRow['companions'];
  rsvp: {
    status: GuestRow['rsvpStatus'];
    persons: number;
    companions: string[];
    note: string;
    respondedAt: string | null;
  };
  notifyEmail: string;
  prefillEmail: string;
};

export const toPublicGuest = (guest: GuestRow): PublicGuest => ({
  name: guest.name,
  token: guest.token,
  maxPersons: guest.maxPersons,
  companions: guest.companions,
  rsvp: {
    status: guest.rsvpStatus,
    persons: guest.rsvpPersons,
    companions: guest.rsvpCompanions,
    note: guest.rsvpNote,
    respondedAt: guest.respondedAt?.toISOString() ?? null,
  },
  notifyEmail: guest.notifyEmail,
  prefillEmail: guest.notifyEmail || guest.email,
});

/**
 * Only approved photos are exposed, and only while the gallery is open (SYS-3 in
 * Europe/Belgrade). Signed URLs and cursor pagination are added in M4; until then
 * `url`/`thumbUrl` are null and the UI does not render photos yet.
 */
export type PublicGallery = {
  open: boolean;
  mode: EventRow['settings']['galleryOpen'];
  opensAt: string | null;
  photos: {
    id: string;
    url: string | null;
    thumbUrl: string | null;
    senderName: string;
    message: string;
    category: 'memories' | 'wedding';
    createdAt: string;
  }[];
};

export const publicGalleryFor = async (event: EventRow, now: Date = new Date()): Promise<PublicGallery> => {
  const open = isGalleryOpen(event, now);
  const photosRows = open
    ? await getDb()
        .select()
        .from(photos)
        .where(and(eq(photos.eventId, event.id), eq(photos.status, 'approved')))
        .orderBy(asc(photos.createdAt), asc(photos.id))
    : [];

  return {
    open,
    mode: event.settings.galleryOpen,
    opensAt: galleryOpensAt(event),
    photos: photosRows.map((photo) => ({
      id: photo.id,
      url: null,
      thumbUrl: null,
      senderName: photo.senderName,
      message: photo.message,
      category: photo.category,
      createdAt: photo.createdAt.toISOString(),
    })),
  };
};

/** Initial data for the server-rendered guest page (same rules as the HTTP route). */
export const getGuestInvitation = async (
  token: string,
): Promise<{ guest: GuestRow; event: EventRow; publicGuest: PublicGuest; publicWedding: PublicWedding } | null> => {
  const guest = await guestByToken(token);
  if (!guest) return null;
  const event = await eventById(guest.eventId);
  if (!event) return null;
  return { guest, event, publicGuest: toPublicGuest(guest), publicWedding: toPublicWedding(event) };
};

export const guestByToken = async (token: string): Promise<GuestRow | null> => {
  const [guest] = await getDb().select().from(guests).where(eq(guests.token, token)).limit(1);
  return guest ?? null;
};

export const eventById = async (id: string): Promise<EventRow | null> => {
  const [event] = await getDb().select().from(events).where(eq(events.id, id)).limit(1);
  return event ?? null;
};

export const eventBySlug = async (slug: string): Promise<EventRow | null> => {
  const [event] = await getDb().select().from(events).where(eq(events.slug, slug)).limit(1);
  return event ?? null;
};

/** Marks the invitation as opened once; the first timestamp is kept. */
export const markInvitationOpened = async (guest: GuestRow): Promise<void> => {
  if (guest.openedAt) return;
  await getDb().update(guests).set({ openedAt: new Date() }).where(eq(guests.id, guest.id));
};

const noteOf = (input: { note?: unknown }): string => {
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > MAX_MESSAGE_LENGTH) throw new RuleViolation('textTooLong', { max: MAX_MESSAGE_LENGTH });
  return note;
};

/** Public RSVP (UC-59): pending is not accepted and `respondedAt` is always set. */
export const applyPublicRsvp = async (
  guest: GuestRow,
  input: { status?: unknown; persons?: unknown; companions?: unknown; note?: unknown },
): Promise<GuestRow> => {
  const parsed = parseRsvp(
    { companions: guest.companions, rsvp: { note: guest.rsvpNote } },
    { ...input, note: noteOf(input) },
  );
  const [updated] = await getDb()
    .update(guests)
    .set({
      rsvpStatus: parsed.status,
      rsvpPersons: parsed.persons,
      rsvpCompanions: parsed.companions,
      rsvpNote: parsed.note,
      respondedAt: new Date(),
    })
    .where(eq(guests.id, guest.id))
    .returning();
  if (!updated) throw new Error('Could not save the RSVP.');
  return updated;
};

const emailOf = (value: unknown): string => {
  const email = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!isEmail(email)) throw new RuleViolation('invalidEmail');
  return email;
};

/** Guest "notify me when photos are ready" (UC-68); a new address resets `sentAt` (SYS-4). */
export const setGuestNotify = async (
  guest: GuestRow,
  input: { email?: unknown },
  locale: Language,
): Promise<string> => {
  const email = emailOf(input.email);
  const changed = guest.notifyEmail !== email;
  await getDb()
    .update(guests)
    .set({
      notifyEmail: email,
      notifyLocale: locale,
      notifyRequestedAt: new Date(),
      notifySentAt: changed ? null : guest.notifySentAt,
    })
    .where(eq(guests.id, guest.id));
  return email;
};

/** QR subscriber (UC-69); duplicates are ignored by the unique (event, email) index. */
export const addPhotoSubscriber = async (
  event: EventRow,
  input: { email?: unknown; name?: unknown },
  locale: Language,
): Promise<string> => {
  const email = emailOf(input.email);
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, MAX_NAME_LENGTH) : '';
  await getDb()
    .insert(photoSubscribers)
    .values({ eventId: event.id, email, name, locale })
    .onConflictDoNothing({ target: [photoSubscribers.eventId, photoSubscribers.email] });
  return email;
};
