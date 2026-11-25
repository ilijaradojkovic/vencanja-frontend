/**
 * Deterministic, idempotent local seed runner (LOCAL_DEVELOPMENT.md §3).
 *
 * Creates verified Auth users through the Supabase Admin API (passwords are never
 * hashed by hand), upserts profiles/events/guests/photos/subscribers with fixed
 * UUIDs, and uploads real JPEG/PNG/WebP files into the private local `photos`
 * bucket. It refuses to run against anything but the local stack and sends no
 * email.
 */
import { randomUUID } from 'node:crypto';

import { businessDate } from '@uspomena/shared';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import sharp from 'sharp';
import postgres from 'postgres';

import {
  DEFAULT_INVITATION,
  DEFAULT_SETTINGS,
  SEED_EVENT_IDS,
  SEED_EVENTS,
  SEED_GUESTS,
  SEED_LIMIT_PHOTOS,
  SEED_PHOTOS,
  SEED_SUBSCRIBERS,
  SEED_USER_IDS,
  SEED_USERS,
  type SeedEvent,
  type SeedPhoto,
  type SeedUser,
} from './fixtures.ts';
import * as schema from './schema.ts';

const BUCKET = 'photos';
const BELLGRADE = 'Europe/Belgrade';

const env = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
};

const fail = (message: string): never => {
  process.stderr.write(`\n✖ ${message}\n`);
  process.exit(1);
};

const isLocalUrl = (value: string): boolean => {
  try {
    const { hostname } = new URL(value);
    return hostname === '127.0.0.1' || hostname === 'localhost';
  } catch {
    return false;
  }
};

if (!isLocalUrl(env.supabaseUrl)) fail(`SUPABASE_URL must be the local stack, received "${env.supabaseUrl}".`);
if (!env.databaseUrl) fail('DATABASE_URL is not set.');
if (!env.serviceKey) fail('SUPABASE_SERVICE_ROLE_KEY is not set.');

const client = postgres(env.databaseUrl, { max: 4, prepare: false });
const db = drizzle(client, { schema });

const api = async (path: string, init: RequestInit = {}): Promise<Response> =>
  fetch(`${env.supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: env.serviceKey,
      authorization: `Bearer ${env.serviceKey}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

type AuthUser = { id: string; email: string };

const listAuthUsers = async (): Promise<AuthUser[]> => {
  const users: AuthUser[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const response = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
    if (!response.ok) fail(`Could not list Auth users (${response.status}).`);
    const body = (await response.json()) as { users?: AuthUser[] };
    const batch = body.users ?? [];
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users;
};

const ensureAuthUser = async (user: SeedUser, existing: Map<string, AuthUser>): Promise<string> => {
  const found = existing.get(user.email);
  const id = SEED_USER_IDS[user.key];
  const payload = {
    email: user.email,
    password: user.password,
    email_confirm: user.emailConfirmed,
    user_metadata: { locale: user.locale, name: user.name },
    app_metadata: user.googleLinked ? { provider: 'google', providers: ['google'] } : {},
  };

  if (found) {
    const response = await api(`/auth/v1/admin/users/${found.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!response.ok) fail(`Could not update Auth user ${user.email} (${response.status}).`);
    return found.id;
  }

  const response = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ id, ...payload }),
  });
  if (!response.ok) {
    const body = await response.text();
    return fail(`Could not create Auth user ${user.email} (${response.status}): ${body}`);
  }
  const created = (await response.json()) as AuthUser;
  existing.set(user.email, created);
  return created.id;
};

const belgradeMidnight = (date: Date): Date => {
  const [year, month, day] = businessDate(date)
    .split('-')
    .map((part) => Number(part));
  const guess = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 0, 0, 0);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BELLGRADE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(guess + 12 * 3_600_000));
  const value = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const offset =
    Date.UTC(value('year'), value('month') - 1, value('day'), value('hour') % 24, value('minute')) -
    (guess + 12 * 3_600_000);
  return new Date(guess - offset);
};

const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * 86_400_000);

const addMonths = (date: Date, months: number): Date => {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

const eventDate = (event: SeedEvent, today: Date): string => event.date ?? businessDate(addDays(today, -30));

const purgeAt = (event: SeedEvent, today: Date): Date => {
  if (event.purgeAfterDays !== null) {
    return belgradeMidnight(addDays(belgradeMidnight(today), event.purgeAfterDays));
  }
  return belgradeMidnight(addMonths(new Date(`${eventDate(event, today)}T00:00:00Z`), event.retentionMonths));
};

const upsertProfiles = async (ids: Map<SeedUser['key'], string>, today: Date): Promise<void> => {
  for (const user of SEED_USERS) {
    if (!user.profile) continue;
    const id = ids.get(user.key) ?? fail(`Missing profile id for ${user.key}`);
    await db
      .insert(schema.profiles)
      .values({
        id,
        role: user.role,
        email: user.email,
        name: user.name,
        phone: user.phone,
        locale: user.locale,
        active: user.active,
        tokensValidAfter: user.active ? null : addDays(today, -1),
        termsAcceptedAt: user.onboarded ? addDays(today, -20) : null,
        termsVersion: user.onboarded ? 'local-draft-1' : null,
        privacyVersion: user.onboarded ? 'local-draft-1' : null,
        onboardedAt: user.onboarded ? addDays(today, -18) : null,
        lastLoginAt: user.active ? addDays(today, -1) : null,
      })
      .onConflictDoUpdate({
        target: schema.profiles.id,
        set: {
          role: user.role,
          email: user.email,
          name: user.name,
          phone: user.phone,
          locale: user.locale,
          active: user.active,
          tokensValidAfter: user.active ? null : addDays(today, -1),
          termsAcceptedAt: user.onboarded ? addDays(today, -20) : null,
          onboardedAt: user.onboarded ? addDays(today, -18) : null,
          lastLoginAt: user.active ? addDays(today, -1) : null,
        },
      });
  }
};

const upsertEvents = async (ids: Map<SeedUser['key'], string>, today: Date): Promise<void> => {
  for (const event of SEED_EVENTS) {
    const ownerId = ids.get(event.owner) ?? fail(`Missing owner id for ${event.owner}`);
    const values = {
      id: SEED_EVENT_IDS[event.key],
      ownerId,
      type: event.type,
      occasion: event.occasion,
      slug: event.slug,
      partner1: event.partner1,
      partner2: event.partner2,
      date: eventDate(event, today),
      rsvpDeadline: null,
      city: event.city,
      invitation: {
        ...DEFAULT_INVITATION,
        headline: event.type === 'celebration' ? 'Proslavljamo' : DEFAULT_INVITATION.headline,
      },
      settings: { ...DEFAULT_SETTINGS, ...(event.settings ?? {}) },
      retentionMonths: event.retentionMonths,
      storageLimitBytes: event.storageLimitBytes ?? 50_000_000,
      purgeAt: purgeAt(event, today),
      purgeWarned30At: event.purgeWarned30 ? addDays(today, -10) : null,
      purgeWarned7At: event.purgeWarned7 ? addDays(today, -3) : null,
      purgedAt: event.purged ? addDays(today, -7) : null,
      updatedAt: today,
    };
    await db.insert(schema.events).values(values).onConflictDoUpdate({ target: schema.events.id, set: values });
  }
};

const upsertGuests = async (today: Date): Promise<void> => {
  for (const guest of SEED_GUESTS) {
    const notifyRequestedAt = guest.notify?.requested ? addDays(today, -5) : null;
    const values = {
      id: guest.id,
      eventId: SEED_EVENT_IDS.wedding,
      name: guest.name,
      email: guest.email,
      phone: '',
      token: guest.token,
      side: guest.side,
      companions: guest.companions,
      maxPersons: 1 + (guest.companions.type === 'named' ? guest.companions.names.length : guest.companions.max),
      invitedAt: addDays(today, -20),
      openedAt: guest.rsvpStatus === 'pending' ? null : addDays(today, -10),
      rsvpStatus: guest.rsvpStatus,
      rsvpPersons: guest.rsvpPersons,
      rsvpCompanions: guest.rsvpCompanions,
      rsvpNote: guest.rsvpNote,
      respondedAt: guest.rsvpStatus === 'pending' ? null : addDays(today, -8),
      notifyEmail: guest.notify?.email ?? '',
      notifyLocale: guest.notify?.locale ?? 'sr',
      notifyRequestedAt,
      notifySentAt: guest.notify?.sent && notifyRequestedAt ? addDays(today, -4) : null,
      notifyClaimedAt: null,
      notifyClaimToken: null,
    };
    await db.insert(schema.guests).values(values).onConflictDoUpdate({ target: schema.guests.id, set: values });
  }
};

const upsertSubscribers = async (today: Date): Promise<void> => {
  for (const subscriber of SEED_SUBSCRIBERS) {
    const values = {
      id: subscriber.id,
      eventId: SEED_EVENT_IDS.wedding,
      email: subscriber.email,
      name: subscriber.name,
      locale: subscriber.locale,
      createdAt: addDays(today, -6),
      sentAt: subscriber.sent ? addDays(today, -5) : null,
      claimedAt: subscriber.sent ? addDays(today, -5) : null,
      claimToken: null,
    };
    await db
      .insert(schema.photoSubscribers)
      .values(values)
      .onConflictDoUpdate({
        target: schema.photoSubscribers.id,
        set: { email: values.email, name: values.name, locale: values.locale, sentAt: values.sentAt },
      });
  }
};

const SIZES = {
  original: { width: 1200, height: 800 },
  web: { width: 800, height: 533 },
  thumb: { width: 320, height: 213 },
} as const;

const renderImage = (photo: SeedPhoto, size: keyof typeof SIZES): Promise<Buffer> => {
  const { width, height } = SIZES[size];
  return sharp({ create: { width, height, channels: 3, background: photo.color } })
    .toFormat(photo.format, photo.format === 'jpeg' ? { quality: 82 } : {})
    .toBuffer();
};

const extension = (format: SeedPhoto['format']): string => (format === 'jpeg' ? 'jpg' : format);
const mimeOf = (format: SeedPhoto['format']): string => `image/${format}`;

const upload = async (path: string, body: Buffer, mime: string): Promise<void> => {
  const response = await fetch(`${env.supabaseUrl}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: env.serviceKey,
      authorization: `Bearer ${env.serviceKey}`,
      'content-type': mime,
      'x-upsert': 'true',
    },
    body,
  });
  if (!response.ok) fail(`Storage upload failed for ${path} (${response.status}): ${await response.text()}`);
};

const seedPhotos = async (eventId: string, photos: readonly SeedPhoto[], today: Date): Promise<number> => {
  let originalBytes = 0;

  for (const photo of photos) {
    const ext = extension(photo.format);
    const base = `events/${eventId}`;
    const paths = {
      originalPath: photo.files ? `${base}/original/${photo.id}.${ext}` : null,
      webPath: photo.files ? `${base}/web/${photo.id}.${ext}` : null,
      thumbPath: photo.files ? `${base}/thumb/${photo.id}.${ext}` : null,
    };

    let originalSize = photo.sizeBytes;
    if (photo.files) {
      const original = await renderImage(photo, 'original');
      const web = await renderImage(photo, 'web');
      const thumb = await renderImage(photo, 'thumb');
      const mime = mimeOf(photo.format);
      await upload(paths.originalPath as string, original, mime);
      await upload(paths.webPath as string, web, mime);
      await upload(paths.thumbPath as string, thumb, mime);
      originalSize = original.byteLength;
      originalBytes += originalSize;
    }

    const values = {
      id: photo.id,
      eventId,
      guestId: photo.guestId,
      senderName: photo.senderName,
      category: photo.category,
      message: photo.message,
      status: photo.status,
      uploadKeyHash: null,
      originalPath: paths.originalPath,
      webPath: paths.webPath,
      thumbPath: paths.thumbPath,
      mime: photo.files ? mimeOf(photo.format) : null,
      sizeBytes: originalSize,
      width: photo.files ? SIZES.original.width : null,
      height: photo.files ? SIZES.original.height : null,
      createdAt: photo.status === 'uploading' ? addDays(today, -2) : addDays(today, -9),
      uploadedAt: photo.status === 'uploading' ? null : addDays(today, -9),
    };
    await db.insert(schema.photos).values(values).onConflictDoUpdate({ target: schema.photos.id, set: values });
  }

  return originalBytes;
};

const linkGoogleIdentity = async (userId: string): Promise<void> => {
  const identityId = randomUUID();
  await client`
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (
      ${identityId}::uuid,
      ${userId}::uuid,
      ${`google-${userId.slice(0, 8)}`},
      'google',
      ${JSON.stringify({ sub: `google-${userId.slice(0, 8)}`, email: 'google@uspomena.test', email_verified: true, provider: 'google' })}::jsonb,
      now(),
      now(),
      now()
    )
    on conflict (provider_id, provider) do nothing
  `;
};

const main = async (): Promise<void> => {
  const today = new Date();
  process.stdout.write('Seeding local Uspomena data\n');

  const existingUsers = new Map((await listAuthUsers()).map((user) => [user.email, user]));
  const authIds = new Map<SeedUser['key'], string>();
  for (const user of SEED_USERS) {
    const id = await ensureAuthUser(user, existingUsers);
    authIds.set(user.key, id);
    if (user.googleLinked) await linkGoogleIdentity(id);
  }
  process.stdout.write(`  ✓ auth users: ${SEED_USERS.length}\n`);

  await upsertProfiles(authIds, today);
  await upsertEvents(authIds, today);
  await upsertGuests(today);
  await upsertSubscribers(today);

  const weddingBytes = await seedPhotos(SEED_EVENT_IDS.wedding, SEED_PHOTOS, today);
  const limitBytes = await seedPhotos(SEED_EVENT_IDS.storageLimit, SEED_LIMIT_PHOTOS, today);
  await db
    .update(schema.events)
    .set({ storageLimitBytes: limitBytes + 100_000, updatedAt: today })
    .where(eq(schema.events.id, SEED_EVENT_IDS.storageLimit));
  process.stdout.write(
    `  ✓ photos: ${SEED_PHOTOS.length + SEED_LIMIT_PHOTOS.length} rows, ${weddingBytes + limitBytes} original bytes in Storage\n`,
  );

  process.stdout.write(
    `  ✓ events: ${SEED_EVENTS.length}, guests: ${SEED_GUESTS.length}, subscribers: ${SEED_SUBSCRIBERS.length}\n`,
  );
};

try {
  await main();
  process.stdout.write('\nSeed data ready. Log in with any .test account below (local only).\n');
  process.stdout.write('  couple@uspomena.test / couple-local-123        wedding, guests, photos, gallery open\n');
  process.stdout.write('  celebration@uspomena.test / celebration-local-123  celebration, manual gallery (open)\n');
  process.stdout.write('  admin@uspomena.test / admin-local-123           superadmin\n');
  process.stdout.write('  new-organizer@uspomena.test / new-organizer-local-123  onboarding\n');
  process.stdout.write('  inactive@uspomena.test / inactive-local-123    deactivated\n');
  process.stdout.write(
    '  retention-30@uspomena.test, retention-7@uspomena.test, archived@uspomena.test, storage-limit@uspomena.test\n',
  );
  process.stdout.write(
    '  guest rows: seedguest001 … seedguest007 (personal links arrive with the M3 invitation port)\n',
  );
  process.stdout.write('  QR upload:   http://localhost:3000/w/ana-i-marko/upload\n');
  process.stdout.write('  gallery:     http://localhost:3000/w/ana-i-marko/galerija\n');
} catch (error) {
  process.stderr.write(
    `\n✖ Seeding failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
