import {
  isEmail,
  isEventDate,
  isValidPhone,
  MAX_CITY_LENGTH,
  MAX_NAME_LENGTH,
  normalizePhone,
  RuleViolation,
} from '@uspomena/shared';
import type { MessageKey } from '@uspomena/shared';
import { and, count, desc, eq, inArray, ne, sql } from 'drizzle-orm';

import { getDb } from '../db/client.ts';
import { events, guests, photos, profiles } from '../db/schema.ts';
import {
  createAuthUser,
  deleteAuthUser,
  generatePassword,
  listAuthProviders,
  revokeAuthSessions,
  updateAuthUser,
} from './auth-admin.ts';
import { createEvent, findEventForOwner, purgeAtFor, type EventRow } from './events.ts';
import { deleteObjects } from './storage.ts';

/** A business error the admin routes translate into the shared error envelope. */
export class AdminError extends Error {
  constructor(
    readonly status: 409 | 404 | 403,
    readonly code: MessageKey,
  ) {
    super(code);
    this.name = 'AdminError';
  }
}

export type AdminWedding = {
  id: string;
  type: 'wedding' | 'celebration';
  occasion: string;
  slug: string;
  partner1: string;
  partner2: string;
  date: string;
  city: string;
  guestCount: number;
  photoCount: number;
  retentionMonths: number;
  storageLimitBytes: number;
  storageUsedBytes: number;
  purgeAt: string;
  purgedAt: string | null;
};

export type AdminAccount = {
  id: string;
  email: string;
  name: string;
  phone: string;
  locale: 'sr' | 'en' | 'ru';
  active: boolean;
  onboarded: boolean;
  providers: string[];
  lastLoginAt: string | null;
  createdAt: string;
  wedding: AdminWedding | null;
};

export type AdminAccountInput = {
  type?: 'wedding' | 'celebration';
  partner1?: string;
  partner2?: string;
  occasion?: string;
  date?: string;
  email?: string;
  phone?: string;
  city?: string;
  active?: boolean;
  password?: string;
};

const MIN_PASSWORD = 6;

const text = (value: unknown, max: number, code: 'nameTooLong' | 'cityTooLong'): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length > max) throw new RuleViolation(code);
  return trimmed;
};

const emailOf = (value: unknown): string => {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!isEmail(email)) throw new RuleViolation('invalidEmail');
  return email;
};

const phoneOf = (value: unknown): string => {
  const phone = normalizePhone(value);
  if (!isValidPhone(phone)) throw new RuleViolation('invalidPhone');
  return phone;
};

const passwordOf = (value: unknown): string | null => {
  const password = typeof value === 'string' ? value.trim() : '';
  if (!password) return null;
  if (password.length < MIN_PASSWORD) throw new RuleViolation('passwordTooShort');
  return password;
};

type EventDraft = {
  type: 'wedding' | 'celebration';
  partner1: string;
  partner2: string;
  occasion: string;
  date: string;
  city: string;
};

/** Same rules as `POST /onboarding` and `POST /admin/accounts` (UC-72, UC-73). */
const parseEvent = (input: AdminAccountInput, existing?: EventRow): EventDraft => {
  const type = input.type ?? (existing?.type as EventDraft['type']) ?? 'wedding';
  if (type !== 'wedding' && type !== 'celebration') throw new RuleViolation('badRequest');

  const partner1 = text(input.partner1 ?? existing?.partner1, MAX_NAME_LENGTH, 'nameTooLong');
  const celebration = type === 'celebration';
  const partner2 = celebration ? '' : text(input.partner2 ?? existing?.partner2, MAX_NAME_LENGTH, 'nameTooLong');
  const occasion = celebration ? text(input.occasion ?? existing?.occasion, MAX_NAME_LENGTH, 'nameTooLong') : '';
  const city = text(input.city ?? existing?.city, MAX_CITY_LENGTH, 'cityTooLong');
  const date = typeof (input.date ?? existing?.date) === 'string' ? (input.date ?? existing?.date ?? '') : '';

  const switchingType = existing && existing.type !== type;
  if (!partner1) throw new RuleViolation(celebration ? 'celebrantRequired' : 'namesRequired');
  if (!celebration && (!partner2 || (switchingType && !input.partner2))) throw new RuleViolation('namesRequired');
  if (!isEventDate(date)) throw new RuleViolation(celebration ? 'celebrationDateRequired' : 'dateRequired');

  return { type, partner1, partner2, occasion, date, city };
};

const displayName = (draft: EventDraft): string =>
  draft.type === 'wedding'
    ? `${draft.partner1} i ${draft.partner2}`
    : [draft.partner1, draft.occasion].filter(Boolean).join(' · ');

const toIso = (value: Date | null): string | null => value?.toISOString() ?? null;

const buildWedding = (
  event: EventRow,
  counts: { guests: number; photos: number; storageUsed: number },
): AdminWedding => ({
  id: event.id,
  type: event.type,
  occasion: event.occasion,
  slug: event.slug,
  partner1: event.partner1,
  partner2: event.partner2,
  date: event.date,
  city: event.city,
  guestCount: counts.guests,
  photoCount: counts.photos,
  retentionMonths: event.retentionMonths,
  storageLimitBytes: event.storageLimitBytes,
  storageUsedBytes: counts.storageUsed,
  purgeAt: event.purgeAt.toISOString(),
  purgedAt: toIso(event.purgedAt),
});

export const listAccounts = async (): Promise<AdminAccount[]> => {
  const db = getDb();
  const rows = await db
    .select({ profile: profiles, event: events })
    .from(profiles)
    .leftJoin(events, eq(events.ownerId, profiles.id))
    .where(eq(profiles.role, 'couple'))
    .orderBy(desc(profiles.createdAt));

  const eventIds = rows.map((row) => row.event?.id).filter((id): id is string => Boolean(id));
  const guestCounts = new Map<string, number>();
  const photoCounts = new Map<string, number>();
  const storageUsed = new Map<string, number>();

  if (eventIds.length > 0) {
    const guestRows = await db
      .select({ eventId: guests.eventId, total: count() })
      .from(guests)
      .where(inArray(guests.eventId, eventIds))
      .groupBy(guests.eventId);
    for (const row of guestRows) guestCounts.set(row.eventId, Number(row.total));

    const photoRows = await db
      .select({
        eventId: photos.eventId,
        total: count(),
        used: sql<string>`coalesce(sum(${photos.sizeBytes}), 0)`,
      })
      .from(photos)
      .where(and(inArray(photos.eventId, eventIds), ne(photos.status, 'uploading')))
      .groupBy(photos.eventId);
    for (const row of photoRows) {
      photoCounts.set(row.eventId, Number(row.total));
      storageUsed.set(row.eventId, Number(row.used));
    }
  }

  const providers = await listAuthProviders();
  return rows.map(({ profile, event }) => ({
    id: profile.id,
    email: profile.email,
    name: profile.name,
    phone: profile.phone,
    locale: profile.locale,
    active: profile.active,
    onboarded: Boolean(profile.onboardedAt),
    providers: providers.get(profile.id) ?? [],
    lastLoginAt: toIso(profile.lastLoginAt),
    createdAt: profile.createdAt.toISOString(),
    wedding: event
      ? buildWedding(event, {
          guests: guestCounts.get(event.id) ?? 0,
          photos: photoCounts.get(event.id) ?? 0,
          storageUsed: storageUsed.get(event.id) ?? 0,
        })
      : null,
  }));
};

const accountOrThrow = async (
  id: string,
): Promise<{ profile: typeof profiles.$inferSelect; event: EventRow | null }> => {
  const [profile] = await getDb().select().from(profiles).where(eq(profiles.id, id)).limit(1);
  if (!profile || profile.role !== 'couple') throw new AdminError(404, 'accountNotFound');
  const event = await findEventForOwner(id);
  return { profile, event };
};

const ensureEmailFree = async (email: string, exceptId: string): Promise<void> => {
  const [taken] = await getDb()
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.email, email), ne(profiles.id, exceptId)))
    .limit(1);
  if (taken) throw new AdminError(409, 'emailTaken');
};

/** `POST /admin/accounts` (UC-72): Auth user, profile, event and a password in one call. */
export const createAccount = async (input: AdminAccountInput): Promise<{ account: AdminAccount; password: string }> => {
  const draft = parseEvent(input);
  const email = emailOf(input.email);
  const phone = phoneOf(input.phone);
  const password = passwordOf(input.password) ?? generatePassword();

  const [existing] = await getDb().select({ id: profiles.id }).from(profiles).where(eq(profiles.email, email)).limit(1);
  if (existing) throw new AdminError(409, 'emailTaken');

  const created = await createAuthUser({ email, password, locale: 'sr' });
  if ('error' in created) {
    if (created.error.code === 'email_exists') throw new AdminError(409, 'emailTaken');
    throw new Error(`Supabase Auth could not create the user: ${created.error.message}`);
  }

  const db = getDb();
  const now = new Date();
  const [profile] = await db
    .insert(profiles)
    .values({
      id: created.user.id,
      role: 'couple',
      email,
      name: displayName(draft),
      phone,
      locale: 'sr',
      onboardedAt: now,
      lastLoginAt: null,
    })
    .returning();
  if (!profile) throw new Error('Could not create the profile.');

  try {
    await createEvent({
      ownerId: created.user.id,
      type: draft.type,
      partner1: draft.partner1,
      partner2: draft.partner2,
      occasion: draft.occasion,
      date: draft.date,
      city: draft.city,
      locale: 'sr',
    });
  } catch (error) {
    // Leave no half-created account behind.
    await db.delete(profiles).where(eq(profiles.id, created.user.id));
    await deleteAuthUser(created.user.id);
    throw error;
  }

  const accounts = await listAccounts();
  const account = accounts.find((item) => item.id === created.user.id);
  if (!account) throw new Error('The created account could not be read back.');
  return { account, password };
};

/** `PATCH /admin/accounts/:id` (UC-73, UC-75). */
export const updateAccount = async (id: string, input: AdminAccountInput): Promise<AdminAccount> => {
  const { profile, event } = await accountOrThrow(id);
  const db = getDb();

  const email = input.email === undefined ? profile.email : emailOf(input.email);
  if (email !== profile.email) await ensureEmailFree(email, id);

  const phone = input.phone === undefined ? profile.phone : phoneOf(input.phone);
  const hasEventFields = ['type', 'partner1', 'partner2', 'occasion', 'date', 'city'].some(
    (key) => input[key as keyof AdminAccountInput] !== undefined,
  );
  const draft = hasEventFields ? parseEvent(input, event ?? undefined) : null;

  if (email !== profile.email) {
    const updated = await updateAuthUser(id, { email });
    if ('error' in updated) {
      if (updated.error.code === 'email_exists') throw new AdminError(409, 'emailTaken');
      throw new Error(`Supabase Auth could not update the email: ${updated.error.message}`);
    }
  }

  if (draft && !event) {
    // An account that has not finished onboarding gets its event from the superadmin.
    await createEvent({
      ownerId: id,
      type: draft.type,
      partner1: draft.partner1,
      partner2: draft.partner2,
      occasion: draft.occasion,
      date: draft.date,
      city: draft.city,
      locale: profile.locale,
    });
    await db.update(profiles).set({ onboardedAt: new Date() }).where(eq(profiles.id, id));
  } else if (draft && event) {
    const purgeAt = draft.date !== event.date ? purgeAtFor(draft.date, event.retentionMonths) : event.purgeAt;
    await db
      .update(events)
      .set({
        type: draft.type,
        partner1: draft.partner1,
        partner2: draft.partner2,
        occasion: draft.occasion,
        city: draft.city,
        date: draft.date,
        purgeAt,
        updatedAt: new Date(),
      })
      .where(eq(events.id, event.id));
  }

  const activeChanged = input.active !== undefined && input.active !== profile.active;
  if (activeChanged && input.active === false) {
    await revokeAuthSessions(id);
    await updateAuthUser(id, { banDuration: '876000h' });
  }
  if (activeChanged && input.active === true) {
    await updateAuthUser(id, { banDuration: 'none' });
  }

  await db
    .update(profiles)
    .set({
      email,
      phone,
      name: draft ? displayName(draft) : profile.name,
      ...(activeChanged
        ? input.active
          ? { active: true }
          : { active: false, tokensValidAfter: new Date(Math.floor(Date.now() / 1000) * 1000) }
        : {}),
    })
    .where(eq(profiles.id, id));

  const accounts = await listAccounts();
  const account = accounts.find((item) => item.id === id);
  if (!account) throw new AdminError(404, 'accountNotFound');
  return account;
};

/** `POST /admin/accounts/:id/password` (UC-74): new password, all sessions revoked. */
export const resetAccountPassword = async (id: string, requested?: string): Promise<{ password: string }> => {
  const { profile } = await accountOrThrow(id);
  const password = passwordOf(requested) ?? generatePassword();

  const updated = await updateAuthUser(id, { password });
  if ('error' in updated) throw new Error(`Supabase Auth could not set the password: ${updated.error.message}`);

  await revokeAuthSessions(id);
  await getDb()
    .update(profiles)
    .set({ tokensValidAfter: new Date(Math.floor(Date.now() / 1000) * 1000) })
    .where(eq(profiles.id, profile.id));
  return { password };
};

/** `DELETE /admin/accounts/:id` (UC-76): Storage files, Auth user, profile, event. */
export const deleteAccount = async (id: string): Promise<void> => {
  const { event } = await accountOrThrow(id);
  const db = getDb();

  if (event) {
    const rows = await db
      .select({ original: photos.originalPath, web: photos.webPath, thumb: photos.thumbPath })
      .from(photos)
      .where(eq(photos.eventId, event.id));
    await deleteObjects(
      rows.flatMap((row) => [row.original, row.web, row.thumb]).filter((path): path is string => Boolean(path)),
    );
  }

  await deleteAuthUser(id);
  await db.delete(profiles).where(eq(profiles.id, id));
};

export type MePatch = { name?: string; phone?: string; locale?: 'sr' | 'en' | 'ru' };

/** `PATCH /auth/me` (UC-08, UC-10): phone cannot be cleared; locale from the switcher. */
export const parseMePatch = (input: MePatch): MePatch => {
  const patch: MePatch = {};
  if (input.name !== undefined) {
    const name = text(input.name, MAX_NAME_LENGTH, 'nameTooLong');
    if (!name) throw new RuleViolation('nameRequired');
    patch.name = name;
  }
  if (input.phone !== undefined) patch.phone = phoneOf(input.phone);
  if (input.locale !== undefined) {
    if (input.locale !== 'sr' && input.locale !== 'en' && input.locale !== 'ru') throw new RuleViolation('badRequest');
    patch.locale = input.locale;
  }
  return patch;
};
