import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';
import { photos, profiles } from '../src/db/schema.ts';
import { createSignedReadUrls, READ_URL_TTL_SECONDS } from '../src/services/storage.ts';

/**
 * Signed read URLs (SPEC §6.3, §7.3) against the real local Storage: the organizer
 * list and moderation responses and both public galleries return signed one-hour
 * `url` (web) / `thumbUrl` (thumb) that load without credentials, never expose the
 * original, and stop working once expired.
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

const call = (path: string, method: string, body?: unknown, token?: string) =>
  app.request(path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      'x-real-ip': `198.20.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 20}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

type Organizer = { token: string; eventId: string; guestToken: string; slug: string };

const setup = async (): Promise<Organizer> => {
  const email = unique('signed');
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
  const guestResponse = await call(`/api/weddings/${wedding.id}/guests`, 'POST', { name: 'Jelena' }, token);
  const guest = (await guestResponse.json()).guest as { token: string };
  return { token, eventId: wedding.id, guestToken: guest.token, slug: wedding.slug };
};

const uploadOne = async (guestToken: string): Promise<{ id: string; paths: string[] }> => {
  const buffer = await sharp({
    create: { width: 300, height: 200, channels: 3, background: { r: 120, g: 80, b: 160 } },
  })
    .jpeg()
    .toBuffer();
  const ticket = (
    await (
      await call(`/api/public/invitations/${guestToken}/uploads`, 'POST', {
        category: 'wedding',
        senderName: 'Jelena',
        files: [{ name: 'a.jpg', type: 'image/jpeg', size: buffer.byteLength }],
      })
    ).json()
  ).uploads[0] as { photoId: string; uploadUrl: string; uploadKey: string };

  const put = await fetch(ticket.uploadUrl, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: buffer });
  expect(put.ok).toBe(true);
  const completed = await call(`/api/public/uploads/${ticket.photoId}/complete`, 'POST', {
    uploadKey: ticket.uploadKey,
  });
  expect(completed.status).toBe(200);

  const [row] = await getDb().select().from(photos).where(eq(photos.id, ticket.photoId));
  const paths = [row?.originalPath, row?.webPath, row?.thumbPath].filter((path): path is string => Boolean(path));
  uploaded.push(...paths);
  return { id: ticket.photoId, paths };
};

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

type SignedPhoto = { id: string; status: string; url: string | null; thumbUrl: string | null };

/** The signed URL loads without any credentials and is the expected JPEG derivative. */
const expectLoadable = async (url: string | null, kind: 'web' | 'thumb', photoId: string) => {
  expect(url).toEqual(expect.stringContaining(`/storage/v1/object/sign/photos/`));
  expect(url).toContain(`/${kind}/${photoId}.jpg`);
  expect(url).toContain('token=');
  expect(url).not.toContain('/original/');
  const response = await fetch(url ?? '');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('image/jpeg');
  const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  expect(meta.format).toBe('jpeg');
};

/** The `exp` claim of a Storage signed-URL token, in seconds. */
const expiryOf = (url: string): number => {
  const token = new URL(url).searchParams.get('token') ?? '';
  const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as {
    exp: number;
    iat: number;
  };
  return payload.exp - payload.iat;
};

describe('GET /api/weddings/:id/photos (UC-34)', () => {
  it('lists processed photos newest first with signed web/thumb URLs valid for one hour', async () => {
    const owner = await setup();
    const older = await uploadOne(owner.guestToken);
    const newer = await uploadOne(owner.guestToken);
    // A reservation that never completed is not listed and is not signed.
    const reservation = await call(`/api/public/invitations/${owner.guestToken}/uploads`, 'POST', {
      files: [{ name: 'b.jpg', type: 'image/jpeg', size: 1000 }],
    });
    const reservationId = (await reservation.json()).uploads[0].photoId as string;

    const response = await call(`/api/weddings/${owner.eventId}/photos`, 'GET', undefined, owner.token);
    expect(response.status).toBe(200);
    const list = (await response.json()).photos as SignedPhoto[];
    expect(list.map((photo) => photo.id)).toEqual([newer.id, older.id]);
    expect(list.some((photo) => photo.id === reservationId)).toBe(false);
    expect(list[0]).not.toHaveProperty('originalUrl');

    for (const photo of list) {
      await expectLoadable(photo.url, 'web', photo.id);
      await expectLoadable(photo.thumbUrl, 'thumb', photo.id);
      expect(expiryOf(photo.url ?? '')).toBe(READ_URL_TTL_SECONDS);
      expect(expiryOf(photo.thumbUrl ?? '')).toBe(READ_URL_TTL_SECONDS);
    }

    // URLs are signed per response, not cached.
    const again = (await (await call(`/api/weddings/${owner.eventId}/photos`, 'GET', undefined, owner.token)).json())
      .photos as SignedPhoto[];
    expect(again.map((photo) => photo.id)).toEqual([newer.id, older.id]);
  });

  it('answers 401 without a token and 404 for another organizer’s event', async () => {
    const owner = await setup();
    const other = await setup();
    await uploadOne(owner.guestToken);

    const unauthorized = await call(`/api/weddings/${owner.eventId}/photos`, 'GET');
    expect(unauthorized.status).toBe(401);

    const foreign = await call(`/api/weddings/${owner.eventId}/photos`, 'GET', undefined, other.token);
    expect(foreign.status).toBe(404);
    expect((await foreign.json()).code).toBe('weddingNotFound');
  });

  it('signs the URLs in moderation responses', async () => {
    const owner = await setup();
    const photo = await uploadOne(owner.guestToken);

    const patched = await call(`/api/photos/${photo.id}`, 'PATCH', { status: 'approved' }, owner.token);
    const single = (await patched.json()).photo as SignedPhoto;
    await expectLoadable(single.url, 'web', photo.id);
    await expectLoadable(single.thumbUrl, 'thumb', photo.id);

    const bulk = await call(
      `/api/weddings/${owner.eventId}/photos/bulk-status`,
      'POST',
      { ids: [photo.id], status: 'hidden' },
      owner.token,
    );
    const [bulkPhoto] = (await bulk.json()).photos as SignedPhoto[];
    await expectLoadable(bulkPhoto?.thumbUrl ?? null, 'thumb', photo.id);
  });
});

describe('public galleries (SPEC §6.3 PublicGallery.photos[])', () => {
  it('sign only approved photos while the gallery is open, for the personal and the QR link', async () => {
    const owner = await setup();
    const approved = await uploadOne(owner.guestToken);
    const pending = await uploadOne(owner.guestToken);
    await call(`/api/photos/${approved.id}`, 'PATCH', { status: 'approved' }, owner.token);

    const closed = await call(`/api/public/invitations/${owner.guestToken}/gallery`, 'GET');
    expect((await closed.json()).gallery).toMatchObject({ open: false, photos: [] });

    await call(`/api/weddings/${owner.eventId}`, 'PATCH', { settings: { galleryOpen: 'now' } }, owner.token);
    for (const path of [
      `/api/public/invitations/${owner.guestToken}/gallery`,
      `/api/public/weddings/${owner.slug}/gallery`,
    ]) {
      const response = await call(path, 'GET');
      expect(response.status).toBe(200);
      const gallery = (await response.json()).gallery as {
        photos: (SignedPhoto & { width: number; height: number })[];
      };
      expect(gallery.photos.map((photo) => photo.id)).toEqual([approved.id]);
      expect(gallery.photos.some((photo) => photo.id === pending.id)).toBe(false);
      const [photo] = gallery.photos;
      expect(photo).toMatchObject({ width: 300, height: 200 });
      await expectLoadable(photo?.url ?? null, 'web', approved.id);
      await expectLoadable(photo?.thumbUrl ?? null, 'thumb', approved.id);
      expect(expiryOf(photo?.url ?? '')).toBe(READ_URL_TTL_SECONDS);
    }
  });
});

describe('createSignedReadUrls', () => {
  it('returns URLs that stop working after they expire', async () => {
    const owner = await setup();
    const photo = await uploadOne(owner.guestToken);
    const thumbPath = photo.paths.find((path) => path.includes('/thumb/')) ?? '';

    const signed = await createSignedReadUrls([thumbPath, 'events/missing/thumb/nothing.jpg'], 1);
    expect(signed.has('events/missing/thumb/nothing.jpg')).toBe(false);
    const url = signed.get(thumbPath) ?? '';
    expect((await fetch(url)).status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 2500));
    const expired = await fetch(url);
    expect(expired.status).toBeGreaterThanOrEqual(400);
    expect(expired.ok).toBe(false);
  });

  it('signs nothing for an empty list without calling Storage', async () => {
    expect((await createSignedReadUrls([])).size).toBe(0);
  });
});
