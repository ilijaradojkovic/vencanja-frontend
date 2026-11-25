import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';
import { events, photos, profiles } from '../src/db/schema.ts';
import { env } from '../src/env.ts';

/**
 * Storage limits under concurrency against the real local Storage (DOD M4): the
 * bucket's own size/MIME restrictions on signed PUTs, atomic reservations for many
 * parallel batches, the actual-size check in concurrent completions, the 50 MB
 * default for a new event and a lowered limit that never deletes existing files.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const adminHeaders = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };
const password = 'integration-123';
const created: string[] = [];
const uploaded: string[] = [];
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

const call = (path: string, method: string, body?: unknown, token?: string, headers: Record<string, string> = {}) =>
  app.request(path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      'x-real-ip': `198.19.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 20}`,
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

const image = async (format: 'jpeg' | 'png' | 'webp', width = 240, height = 180): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: { r: 210, g: 120, b: 90 } } })
    .toFormat(format, format === 'jpeg' ? { quality: 82 } : {})
    .toBuffer();

const setup = async (settings?: Record<string, unknown>) => {
  const email = unique('limits-owner');
  await createUser(email);
  const token = await signIn(email);
  const onboarding = await call(
    '/api/onboarding',
    'POST',
    {
      type: 'wedding',
      partner1: 'Ana',
      partner2: 'Marko',
      date: '2027-06-12',
      phone: '064 123 4567',
    },
    token,
  );
  const wedding = (await onboarding.json()).wedding as { id: string; slug: string };
  if (settings) {
    await call(`/api/weddings/${wedding.id}`, 'PATCH', { settings }, token);
  }
  const guestResponse = await call(`/api/weddings/${wedding.id}/guests`, 'POST', { name: 'Jelena Petrović' }, token);
  const guest = (await guestResponse.json()).guest as { id: string; token: string };
  return { token, eventId: wedding.id, slug: wedding.slug, guest };
};

const requestUploads = (guestToken: string, files: { name: string; type: string; size: number }[]) =>
  call(`/api/public/invitations/${guestToken}/uploads`, 'POST', {
    category: 'wedding',
    senderName: 'Jelena Petrović',
    message: 'Pozdrav!',
    files,
  });

const putObject = (uploadUrl: string, buffer: Buffer, type: string) =>
  fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': type }, body: buffer });

const complete = (photoId: string, uploadKey: string) =>
  call(`/api/public/uploads/${photoId}/complete`, 'POST', { uploadKey });

afterAll(async () => {
  const db = getDb();
  if (uploaded.length > 0) {
    await fetch(`${supabaseUrl}/storage/v1/object/photos`, {
      method: 'DELETE',
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: uploaded }),
    });
  }
  for (const id of created) {
    await db.delete(profiles).where(eq(profiles.id, id));
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders });
  }
  await closeDb();
});

/** A JPEG of roughly the requested byte size (random noise does not compress). */
const noisyJpeg = async (side: number): Promise<Buffer> => {
  const raw = Buffer.alloc(side * side * 3);
  for (let index = 0; index < raw.length; index++) raw[index] = Math.floor(Math.random() * 256);
  return sharp(raw, { raw: { width: side, height: side, channels: 3 } })
    .jpeg({ quality: 90 })
    .toBuffer();
};

const objectExists = async (path: string): Promise<boolean> => {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/photos/${path}`, {
    method: 'HEAD',
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
  });
  return response.ok;
};

const reservedBytes = async (eventId: string): Promise<number> => {
  const rows = await getDb().select().from(photos).where(eq(photos.eventId, eventId));
  return rows.reduce((total, row) => total + (row.sizeBytes ?? 0), 0);
};

describe('storage limits (DOD M4)', () => {
  it('gives a new event the configured 50 MB default', async () => {
    const owner = await setup();
    const [event] = await getDb().select().from(events).where(eq(events.id, owner.eventId));
    expect(env.eventStorageLimitMbDefault()).toBe(50);
    expect(event?.storageLimitBytes).toBe(50_000_000);
    const current = await (await call('/api/weddings/current', 'GET', undefined, owner.token)).json();
    expect(current.wedding.storageLimitBytes).toBe(50_000_000);
  });

  it('lets the private bucket reject a wrong MIME type and a file over 30 MB on the signed PUT', async () => {
    const { guest } = await setup();
    const ticket = async () =>
      (await (await requestUploads(guest.token, [{ name: 'a.jpg', type: 'image/jpeg', size: 1000 }])).json())
        .uploads[0] as { photoId: string; uploadUrl: string; uploadKey: string };

    const wrongType = await putObject((await ticket()).uploadUrl, Buffer.from('not an image'), 'text/plain');
    expect(wrongType.ok).toBe(false);
    expect(wrongType.status).toBeGreaterThanOrEqual(400);

    const tooBig = await putObject((await ticket()).uploadUrl, Buffer.alloc(31 * 1024 * 1024, 1), 'image/jpeg');
    expect(tooBig.ok).toBe(false);
    expect([400, 413]).toContain(tooBig.status);
  });

  it('reserves atomically for many parallel batches and never exceeds the limit', async () => {
    const { guest, eventId } = await setup();
    await getDb().update(events).set({ storageLimitBytes: 100_000 }).where(eq(events.id, eventId));

    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        requestUploads(guest.token, [{ name: `p${index}.jpg`, type: 'image/jpeg', size: 20_000 }]),
      ),
    );
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(5);
    expect(statuses.filter((status) => status === 403)).toHaveLength(7);
    for (const response of responses.filter((entry) => entry.status === 403)) {
      expect((await response.json()).code).toBe('storageLimit');
    }
    expect(await reservedBytes(eventId)).toBe(100_000);
  });

  it('checks the actual size of concurrent completions against the limit under a lock', async () => {
    const { guest, eventId } = await setup();
    const [first, second] = await Promise.all([noisyJpeg(160), noisyJpeg(160)]);
    if (!first || !second) throw new Error('no fixture');
    // Room for one real file but not two; both were declared tiny, so both tickets pass.
    const limit = Math.round(Math.max(first.byteLength, second.byteLength) * 1.5);
    await getDb().update(events).set({ storageLimitBytes: limit }).where(eq(events.id, eventId));

    const tickets = (
      await (
        await requestUploads(guest.token, [
          { name: 'a.jpg', type: 'image/jpeg', size: 100 },
          { name: 'b.jpg', type: 'image/jpeg', size: 100 },
        ])
      ).json()
    ).uploads as { photoId: string; uploadUrl: string; uploadKey: string }[];
    expect(tickets).toHaveLength(2);
    const buffers = [first, second];
    await Promise.all(
      tickets.map(async (ticket, index) => {
        const put = await putObject(ticket.uploadUrl, buffers[index] as Buffer, 'image/jpeg');
        expect(put.ok).toBe(true);
      }),
    );

    const results = await Promise.all(tickets.map((ticket) => complete(ticket.photoId, ticket.uploadKey)));
    const statuses = results.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 403]);
    expect(await reservedBytes(eventId)).toBeLessThanOrEqual(limit);

    // The rejected photo's object and row are gone; the accepted one stays.
    const rows = await getDb().select().from(photos).where(eq(photos.eventId, eventId));
    expect(rows).toHaveLength(1);
    const rejected = tickets.find((ticket) => ticket.photoId !== rows[0]?.id);
    const [eventRow] = await getDb().select().from(events).where(eq(events.id, eventId));
    expect(await objectExists(`events/${eventRow?.id}/original/${rejected?.photoId}.jpg`)).toBe(false);
    uploaded.push(rows[0]?.originalPath ?? '', rows[0]?.webPath ?? '', rows[0]?.thumbPath ?? '');
  });

  it('never deletes existing photos when the limit is lowered; it only blocks new reservations', async () => {
    const owner = await setup();
    const buffer = await image('jpeg');
    const ticket = (
      await (
        await requestUploads(owner.guest.token, [{ name: 'a.jpg', type: 'image/jpeg', size: buffer.byteLength }])
      ).json()
    ).uploads[0] as { photoId: string; uploadUrl: string; uploadKey: string };
    expect((await putObject(ticket.uploadUrl, buffer, 'image/jpeg')).ok).toBe(true);
    expect((await complete(ticket.photoId, ticket.uploadKey)).status).toBe(200);
    const [row] = await getDb().select().from(photos).where(eq(photos.id, ticket.photoId));
    const paths = [row?.originalPath, row?.webPath, row?.thumbPath].filter((path): path is string => Boolean(path));
    uploaded.push(...paths);

    // Lowered below current usage.
    await getDb().update(events).set({ storageLimitBytes: 1 }).where(eq(events.id, owner.eventId));
    const blocked = await requestUploads(owner.guest.token, [{ name: 'b.jpg', type: 'image/jpeg', size: 10 }]);
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).code).toBe('storageLimit');

    const list = await (
      await call(`/api/weddings/${owner.eventId}/photos?status=all`, 'GET', undefined, owner.token)
    ).json();
    expect(list.photos.map((photo: { id: string }) => photo.id)).toEqual([ticket.photoId]);
    for (const path of paths) expect(await objectExists(path)).toBe(true);

    // Raising it again allows new uploads.
    await getDb().update(events).set({ storageLimitBytes: 50_000_000 }).where(eq(events.id, owner.eventId));
    const allowed = await requestUploads(owner.guest.token, [{ name: 'c.jpg', type: 'image/jpeg', size: 10 }]);
    expect(allowed.status).toBe(201);
  });
});
