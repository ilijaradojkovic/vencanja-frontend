import {
  isEmail,
  isGuestSide,
  MAX_NAME_LENGTH,
  maxCompanions,
  normalizePhone,
  parseCompanions,
  parseRsvp,
  RuleViolation,
  trimRsvpToCompanions,
  type CompanionSet,
  type GuestSide,
  type RsvpStatus,
} from '@uspomena/shared';
import { randomInt } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '../db/client.ts';
import { events, guests } from '../db/schema.ts';

export type GuestRow = typeof guests.$inferSelect;

export const MAX_IMPORT_ROWS = 1000;
const TOKEN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const TOKEN_LENGTH = 12;

/** 12 base62 characters from a cryptographic RNG; the token is the guest's only key (API.md). */
export const issueGuestToken = (): string =>
  Array.from({ length: TOKEN_LENGTH }, () => TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)]).join('');

export type GuestPayload = {
  id: string;
  weddingId: string;
  name: string;
  token: string;
  email: string;
  phone: string;
  side: GuestSide;
  companions: CompanionSet;
  maxPersons: number;
  invitedAt: string;
  openedAt: string | null;
  rsvp: {
    status: RsvpStatus;
    persons: number;
    companions: string[];
    note: string;
    respondedAt: string | null;
  };
  photoNotify: { email: string; requestedAt: string | null; sentAt: string | null };
};

const iso = (value: Date | null): string | null => value?.toISOString() ?? null;

export const toGuestPayload = (guest: GuestRow): GuestPayload => ({
  id: guest.id,
  weddingId: guest.eventId,
  name: guest.name,
  token: guest.token,
  email: guest.email,
  phone: guest.phone,
  side: guest.side,
  companions: guest.companions,
  maxPersons: guest.maxPersons,
  invitedAt: guest.invitedAt.toISOString(),
  openedAt: iso(guest.openedAt),
  rsvp: {
    status: guest.rsvpStatus,
    persons: guest.rsvpPersons,
    companions: guest.rsvpCompanions,
    note: guest.rsvpNote,
    respondedAt: iso(guest.respondedAt),
  },
  photoNotify: {
    email: guest.notifyEmail,
    requestedAt: iso(guest.notifyRequestedAt),
    sentAt: iso(guest.notifySentAt),
  },
});

const nameOf = (value: unknown): string => {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw new RuleViolation('guestNameRequired');
  if (name.length > MAX_NAME_LENGTH) throw new RuleViolation('textTooLong', { max: MAX_NAME_LENGTH });
  return name;
};

/** Manual create/edit: an invalid non-empty phone is a validation error (the form asks again). */
const phoneOf = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return '';
  const phone = normalizePhone(value);
  if (!phone) throw new RuleViolation('invalidPhone');
  return phone;
};

const emailOf = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return '';
  const email = String(value).trim().toLowerCase();
  if (!isEmail(email)) throw new RuleViolation('invalidEmail');
  return email;
};

/** Import only: an unusable email is dropped, like an invalid phone (SPEC §6.6 item 6). */
const importEmailOf = (value: unknown): string => {
  const email = String(value ?? '')
    .trim()
    .toLowerCase();
  return isEmail(email) ? email : '';
};

const sideOf = (value: unknown): GuestSide => {
  if (value === undefined) return 'zajednicki';
  if (!isGuestSide(value)) throw new RuleViolation('badSide');
  return value;
};

export type CreateGuestInput = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  side?: unknown;
  companions?: unknown;
  maxPersons?: unknown;
};

/** `POST /weddings/:id/guests` (UC-17, UC-18). */
export const createGuest = async (eventId: string, input: CreateGuestInput): Promise<GuestRow> => {
  const companions = parseCompanions(input.companions, input.maxPersons);
  const side = sideOf(input.side);

  const [guest] = await getDb()
    .insert(guests)
    .values({
      eventId,
      name: nameOf(input.name),
      email: emailOf(input.email),
      phone: phoneOf(input.phone),
      token: issueGuestToken(),
      side,
      companions,
      maxPersons: 1 + maxCompanions({ companions }),
    })
    .returning();
  if (!guest) throw new Error('Could not create the guest.');
  return guest;
};

export type ImportGuestInput = {
  name?: unknown;
  maxPersons?: unknown;
  phone?: unknown;
  email?: unknown;
  side?: unknown;
};

/**
 * `POST /weddings/:id/guests/import` (UC-19, SPEC §6.6 item 6): empty rows are
 * skipped, invalid phones are dropped, an unknown side becomes `zajednicki` and
 * `maxPersons > 1` becomes an open companion allowance.
 */
export const importGuests = async (eventId: string, input: unknown): Promise<GuestRow[]> => {
  if (!Array.isArray(input)) throw new RuleViolation('badRequest');
  if (input.length > MAX_IMPORT_ROWS) throw new RuleViolation('tooManyGuests');

  const rows = input
    .filter((row): row is ImportGuestInput => Boolean(row) && typeof row === 'object')
    .map((row) => ({ ...row, name: typeof row.name === 'string' ? row.name.trim() : '' }))
    .filter((row) => row.name);

  if (rows.length === 0) return [];

  const values = rows.map((row) => {
    const companions = parseCompanions(undefined, row.maxPersons);
    return {
      eventId,
      name: nameOf(row.name),
      email: importEmailOf(row.email),
      phone: normalizePhone(row.phone),
      token: issueGuestToken(),
      side: isGuestSide(row.side) ? row.side : ('zajednicki' as GuestSide),
      companions,
      maxPersons: 1 + maxCompanions({ companions }),
    };
  });

  return getDb().insert(guests).values(values).returning();
};

export type UpdateGuestInput = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  side?: unknown;
  companions?: unknown;
  rsvp?: unknown;
};

/**
 * `PATCH /guests/:id` (UC-18, UC-23, UC-24, SYS-5): changing the companions
 * trims an existing "coming" answer to the invited names / new maximum, and a
 * manual RSVP can set pending again (which clears `respondedAt`).
 */
export const updateGuest = async (eventId: string, guestId: string, input: UpdateGuestInput): Promise<GuestRow> => {
  const db = getDb();
  const [guest] = await db
    .select()
    .from(guests)
    .where(and(eq(guests.id, guestId), eq(guests.eventId, eventId)))
    .limit(1);
  if (!guest) throw new RuleViolation('guestNotFound');

  const patch: Partial<GuestRow> = {};

  if (input.name !== undefined) patch.name = nameOf(input.name);
  if (input.email !== undefined) patch.email = emailOf(input.email);
  if (input.phone !== undefined) patch.phone = phoneOf(input.phone);
  if (input.side !== undefined) patch.side = sideOf(input.side);

  let companions = guest.companions;
  if (input.companions !== undefined) {
    companions = parseCompanions(input.companions);
    patch.companions = companions;
    patch.maxPersons = 1 + maxCompanions({ companions });
    if (input.rsvp === undefined && guest.rsvpStatus === 'yes') {
      const trimmed = trimRsvpToCompanions(
        {
          status: guest.rsvpStatus,
          persons: guest.rsvpPersons,
          companions: guest.rsvpCompanions,
          note: guest.rsvpNote,
        },
        companions,
      );
      patch.rsvpStatus = trimmed.status;
      patch.rsvpPersons = trimmed.persons;
      patch.rsvpCompanions = trimmed.companions;
    }
  }

  if (input.rsvp !== undefined) {
    const parsed = parseRsvp(
      { companions, rsvp: { note: guest.rsvpNote } },
      input.rsvp as { status?: unknown; persons?: unknown; companions?: unknown; note?: unknown },
      { manual: true },
    );
    patch.rsvpStatus = parsed.status;
    patch.rsvpPersons = parsed.persons;
    patch.rsvpCompanions = parsed.companions;
    patch.rsvpNote = parsed.note;
    patch.respondedAt = parsed.status === 'pending' ? null : new Date();
  }

  const [updated] = await db.update(guests).set(patch).where(eq(guests.id, guest.id)).returning();
  if (!updated) throw new Error('Could not update the guest.');
  return updated;
};

/** `DELETE /guests/:id` (UC-25): the personal link stops working, photos stay. */
export const deleteGuest = async (eventId: string, guestId: string): Promise<void> => {
  const [deleted] = await getDb()
    .delete(guests)
    .where(and(eq(guests.id, guestId), eq(guests.eventId, eventId)))
    .returning({ id: guests.id });
  if (!deleted) throw new RuleViolation('guestNotFound');
};

export const listGuests = async (eventId: string): Promise<GuestRow[]> =>
  getDb().select().from(guests).where(eq(guests.eventId, eventId)).orderBy(asc(guests.invitedAt), asc(guests.id));

/** The event must belong to the signed-in organizer; otherwise it does not exist for them. */
export const ownedEventId = async (profileId: string, eventId: string): Promise<string> => {
  const [event] = await getDb()
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.ownerId, profileId)))
    .limit(1);
  return event?.id ?? '';
};

/** Resolves the guest's event only when it belongs to the organizer. */
export const ownedGuest = async (profileId: string, guestId: string): Promise<GuestRow | null> => {
  const [guest] = await getDb().select().from(guests).where(eq(guests.id, guestId)).limit(1);
  if (!guest) return null;
  const eventId = await ownedEventId(profileId, guest.eventId);
  return eventId ? guest : null;
};
