import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';
import { photos, profiles } from '../src/db/schema.ts';

/**
 * Download originals (UC-85, SPEC §6.3) against the real local Storage: paginated
 * signed original URLs with the original bytes, approved/all scopes, unique
 * sanitized file names, totals, the single-photo endpoint and authorization.
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
  const email = unique('originals');
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

const uploadOne = async (
  guestToken: string,
  senderName = 'Jelena',
): Promise<{ id: string; paths: string[]; buffer: Buffer }> => {
  const buffer = await sharp({
    create: { width: 300, height: 200, channels: 3, background: { r: Math.floor(Math.random() * 255), g: 80, b: 160 } },
  })
    .jpeg()
    .toBuffer();
  const ticket = (
    await (
      await call(`/api/public/invitations/${guestToken}/uploads`, 'POST', {
        category: 'wedding',
        senderName,
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
  return { id: ticket.photoId, paths, buffer };
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

type Original = { id: string; filename: string; url: string; size: number };

describe('GET /api/weddings/:id/photos/originals (UC-85)', () => {
  it('returns paginated signed originals with the original bytes and unique sanitized names', async () => {
    const owner = await setup();
    const first = await uploadOne(owner.guestToken, '../Ana: "Kuma"');
    const second = await uploadOne(owner.guestToken, '../Ana: "Kuma"');
    const pending = await uploadOne(owner.guestToken, 'Marko');
    await call(
      `/api/weddings/${owner.eventId}/photos/bulk-status`,
      'POST',
      { ids: [first.id, second.id], status: 'approved' },
      owner.token,
    );
    const base = `/api/weddings/${owner.eventId}/photos/originals`;

    const approvedPage = await call(`${base}?limit=1`, 'GET', undefined, owner.token);
    expect(approvedPage.status).toBe(200);
    const page1 = (await approvedPage.json()) as {
      photos: Original[];
      nextCursor: string | null;
      total: number;
      totalBytes: number;
    };
    expect(page1.total).toBe(2);
    expect(page1.totalBytes).toBe(first.buffer.byteLength + second.buffer.byteLength);
    expect(page1.photos).toHaveLength(1);
    expect(page1.nextCursor).toEqual(expect.any(String));
    const page2 = (await (
      await call(`${base}?limit=1&cursor=${page1.nextCursor}`, 'GET', undefined, owner.token)
    ).json()) as { photos: Original[]; nextCursor: string | null };
    expect(page2.nextCursor).toBeNull();

    const files = [...page1.photos, ...page2.photos];
    expect(files.map((file) => file.id)).toEqual([first.id, second.id]);
    for (const [index, file] of files.entries()) {
      const source = index === 0 ? first : second;
      expect(file.filename).toMatch(new RegExp(`^Ana-Kuma_\\d{4}-\\d{2}-\\d{2}_${file.id}\\.jpg$`));
      expect(file.filename).not.toMatch(/[\\/:"]/);
      expect(file.size).toBe(source.buffer.byteLength);
      expect(file.url).toContain('/original/');
      const response = await fetch(file.url);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-disposition') ?? '').toContain('attachment');
      expect(Buffer.from(await response.arrayBuffer()).equals(source.buffer)).toBe(true);
    }
    expect(new Set(files.map((file) => file.filename)).size).toBe(2);

    const all = (await (await call(`${base}?status=all`, 'GET', undefined, owner.token)).json()) as {
      photos: Original[];
      total: number;
    };
    expect(all.total).toBe(3);
    expect(all.photos.map((file) => file.id)).toContain(pending.id);

    const invalid = await call(`${base}?status=hidden`, 'GET', undefined, owner.token);
    expect(invalid.status).toBe(422);
  });

  it('answers 401 without a token and 404 for another organizer', async () => {
    const owner = await setup();
    const other = await setup();
    const photo = await uploadOne(owner.guestToken);
    const base = `/api/weddings/${owner.eventId}/photos/originals`;
    expect((await call(base, 'GET')).status).toBe(401);
    expect((await call(base, 'GET', undefined, other.token)).status).toBe(404);
    expect((await call(`/api/photos/${photo.id}/original`, 'GET')).status).toBe(401);
    expect((await call(`/api/photos/${photo.id}/original`, 'GET', undefined, other.token)).status).toBe(404);
  });
});

describe('GET /api/photos/:id/original (UC-85 single download)', () => {
  it('returns one signed original with its download name', async () => {
    const owner = await setup();
    const photo = await uploadOne(owner.guestToken, 'Jelena Petrović');
    const response = await call(`/api/photos/${photo.id}/original`, 'GET', undefined, owner.token);
    expect(response.status).toBe(200);
    const { original } = (await response.json()) as { original: Original };
    expect(original.filename).toMatch(/^Jelena-Petrović_\d{4}-\d{2}-\d{2}_/);
    const bytes = Buffer.from(await (await fetch(original.url)).arrayBuffer());
    expect(bytes.equals(photo.buffer)).toBe(true);

    const missing = await call(
      '/api/photos/00000000-0000-4000-8000-000000000000/original',
      'GET',
      undefined,
      owner.token,
    );
    expect(missing.status).toBe(404);
  });
});
