import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';
import { photos, profiles } from '../src/db/schema.ts';

/**
 * Cursor pagination (SPEC §6.3) of the organizer photo list and both public
 * galleries against the real local database: default 50 / max 100, the stable
 * `(createdAt, id)` order including rows with identical and microsecond-apart
 * timestamps, filters, counts and invalid cursors/limits.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const adminHeaders = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };
const password = 'integration-123';
const created: string[] = [];
const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@uspomena.test`;

const createUser = async (email: string): Promise<string> => {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { locale: 'sr' } }),
  });
  const user = (await response.json()) as { id: string };
  created.push(user.id);
  return user.id;
};

const signIn = async (email: string): Promise<string> => {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey || serviceKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return ((await response.json()) as { access_token?: string }).access_token ?? '';
};

/** A unique trusted IP per request, so public buckets never overflow across runs. */
let ipCounter = 0;
const randomIp = (): string => {
  ipCounter += 1;
  return `198.18.${Math.floor(Math.random() * 200) + 1}.${(ipCounter % 200) + 20}`;
};

const call = (path: string, method: string, body?: unknown, token?: string, headers: Record<string, string> = {}) =>
  app.request(path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      'x-real-ip': randomIp(),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

type Setup = { token: string; eventId: string; slug: string; guestToken: string; guestId: string };

const setup = async (): Promise<Setup> => {
  const email = unique('paging');
  await createUser(email);
  const token = await signIn(email);
  const onboarding = await call(
    '/api/onboarding',
    'POST',
    { type: 'wedding', partner1: 'Ana', partner2: 'Marko', date: '2027-06-12', phone: '064 123 4567' },
    token,
  );
  const wedding = (await onboarding.json()).wedding as { id: string; slug: string };
  const guest = (await (await call(`/api/weddings/${wedding.id}/guests`, 'POST', { name: 'Jelena' }, token)).json())
    .guest as { id: string; token: string };
  return { token, eventId: wedding.id, slug: wedding.slug, guestToken: guest.token, guestId: guest.id };
};

/**
 * 120 approved photos: 40 share one exact timestamp (ties broken by id), 40 are a
 * microsecond apart inside one millisecond, 40 are a second apart. Plus 5 pending
 * (from the guest, category memories), 2 hidden and 3 `uploading` reservations.
 */
const seedPhotos = async (eventId: string, guestId: string) => {
  const db = getDb();
  const base = new Date('2026-05-01T10:00:00.000Z');
  const row = (status: 'approved' | 'pending' | 'hidden' | 'uploading', message: string, at: Date, extra = {}) => ({
    eventId,
    status,
    senderName: 'Gost',
    category: 'wedding' as const,
    message,
    createdAt: at,
    ...extra,
  });
  await db
    .insert(photos)
    .values([
      ...Array.from({ length: 40 }, (_, i) => row('approved', `tie-${i}`, base)),
      ...Array.from({ length: 40 }, (_, i) => row('approved', `micro-${i}`, new Date(base.getTime() + 1))),
      ...Array.from({ length: 40 }, (_, i) =>
        row('approved', `second-${i}`, new Date(base.getTime() + (i + 2) * 1000)),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        row('pending', `pending-${i}`, new Date(base.getTime() + 100_000 + i), { guestId, category: 'memories' }),
      ),
      ...Array.from({ length: 2 }, (_, i) => row('hidden', `hidden-${i}`, new Date(base.getTime() + 200_000 + i))),
      ...Array.from({ length: 3 }, (_, i) =>
        row('uploading', `uploading-${i}`, new Date(base.getTime() + 300_000 + i)),
      ),
    ]);
  // Spread the "micro" rows one microsecond apart inside the same millisecond.
  await db.execute(sql`
    update photos p set created_at = p.created_at + (x.n * interval '1 microsecond')
    from (select id, row_number() over (order by id) as n from photos
          where event_id = ${eventId} and message like 'micro-%') x
    where p.id = x.id`);
};

/** The database's own `(created_at, id)` order, to compare pages against. */
const expectedOrder = async (eventId: string, statuses: string[], direction: 'asc' | 'desc'): Promise<string[]> => {
  const result = await getDb().execute<{ id: string }>(sql`
    select id from photos where event_id = ${eventId}
      and status::text = any(${`{${statuses.join(',')}}`}::text[])
    order by created_at ${sql.raw(direction)}, id ${sql.raw(direction)}`);
  return [...result].map((entry) => entry.id);
};

type Page = { photos: { id: string; status: string }[]; nextCursor: string | null };

const collect = async (first: string, token?: string, key: 'photos' | 'gallery' = 'photos') => {
  const pages: Page[] = [];
  let cursor: string | null = null;
  do {
    const separator = first.includes('?') ? '&' : '?';
    const response = await call(
      cursor ? `${first}${separator}cursor=${encodeURIComponent(cursor)}` : first,
      'GET',
      undefined,
      token,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const page = (key === 'gallery' ? body.gallery : body) as Page;
    pages.push(page);
    cursor = page.nextCursor;
  } while (cursor && pages.length < 20);
  return { pages, ids: pages.flatMap((page) => page.photos.map((photo) => photo.id)) };
};

afterAll(async () => {
  const db = getDb();
  for (const id of created) {
    await db.delete(profiles).where(eq(profiles.id, id));
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders });
  }
  await closeDb();
});

describe('GET /api/weddings/:id/photos pagination', () => {
  it('pages newest first in 50s without gaps or repeats, with counts and no reservations', async () => {
    const owner = await setup();
    await seedPhotos(owner.eventId, owner.guestId);

    const { pages, ids } = await collect(`/api/weddings/${owner.eventId}/photos`, owner.token);
    expect(pages.map((page) => page.photos.length)).toEqual([50, 50, 27]);
    expect(pages.at(-1)?.nextCursor).toBeNull();
    expect(new Set(ids).size).toBe(127);
    expect(ids).toEqual(await expectedOrder(owner.eventId, ['approved', 'pending', 'hidden'], 'desc'));

    const first = await (await call(`/api/weddings/${owner.eventId}/photos`, 'GET', undefined, owner.token)).json();
    expect(first.counts).toEqual({ pending: 5, approved: 120, hidden: 2, all: 127 });
  });

  it('caps the limit at 100, orders ascending on request and filters by status, category and guest', async () => {
    const owner = await setup();
    await seedPhotos(owner.eventId, owner.guestId);
    const base = `/api/weddings/${owner.eventId}/photos`;

    const capped = await (await call(`${base}?limit=500`, 'GET', undefined, owner.token)).json();
    expect(capped.photos).toHaveLength(100);
    expect(capped.nextCursor).toEqual(expect.any(String));

    const ascending = await collect(`${base}?status=approved&order=asc&limit=33`, owner.token);
    expect(ascending.pages.map((page) => page.photos.length)).toEqual([33, 33, 33, 21]);
    expect(ascending.ids).toEqual(await expectedOrder(owner.eventId, ['approved'], 'asc'));

    const pending = await (await call(`${base}?status=pending`, 'GET', undefined, owner.token)).json();
    expect(pending.photos).toHaveLength(5);
    expect(pending.nextCursor).toBeNull();
    const memories = await (await call(`${base}?category=memories`, 'GET', undefined, owner.token)).json();
    expect(memories.photos).toHaveLength(5);
    const byGuest = await (await call(`${base}?guestId=${owner.guestId}`, 'GET', undefined, owner.token)).json();
    expect(byGuest.photos).toHaveLength(5);
    const hidden = await (await call(`${base}?status=hidden`, 'GET', undefined, owner.token)).json();
    expect(hidden.photos.map((photo: { status: string }) => photo.status)).toEqual(['hidden', 'hidden']);
  });

  it('rejects invalid limits, cursors and filters with 422', async () => {
    const owner = await setup();
    const base = `/api/weddings/${owner.eventId}/photos`;
    for (const query of [
      'limit=0',
      'limit=abc',
      'cursor=garbage',
      `cursor=${Buffer.from(JSON.stringify(['2026-01-01', 'x'])).toString('base64url')}`,
      'status=uploading',
      'category=selfies',
      'guestId=not-a-uuid',
      'order=sideways',
    ]) {
      const response = await call(`${base}?${query}`, 'GET', undefined, owner.token);
      expect(response.status, query).toBe(422);
      expect((await response.json()).code).toMatch(/badRequest|badStatus/);
    }
  });
});

describe('public gallery pagination', () => {
  it('pages approved photos oldest first on the personal and QR links, with total and category', async () => {
    const owner = await setup();
    await seedPhotos(owner.eventId, owner.guestId);

    const closed = await (await call(`/api/public/invitations/${owner.guestToken}/gallery`, 'GET')).json();
    expect(closed.gallery).toMatchObject({ open: false, total: 0, nextCursor: null, photos: [] });

    await call(`/api/weddings/${owner.eventId}`, 'PATCH', { settings: { galleryOpen: 'now' } }, owner.token);
    const expected = await expectedOrder(owner.eventId, ['approved'], 'asc');
    for (const path of [
      `/api/public/invitations/${owner.guestToken}/gallery`,
      `/api/public/weddings/${owner.slug}/gallery`,
    ]) {
      const { pages, ids } = await collect(path, undefined, 'gallery');
      expect(pages.map((page) => page.photos.length)).toEqual([50, 50, 20]);
      expect(ids).toEqual(expected);
      const first = (await (await call(path, 'GET')).json()).gallery;
      expect(first.total).toBe(120);
    }

    const memories = (await (await call(`/api/public/weddings/${owner.slug}/gallery?category=memories`, 'GET')).json())
      .gallery;
    expect(memories).toMatchObject({ total: 0, nextCursor: null, photos: [] });

    const bad = await call(`/api/public/weddings/${owner.slug}/gallery?cursor=garbage`, 'GET');
    expect(bad.status).toBe(422);
  });
});
