import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';
import { photos, profiles } from '../src/db/schema.ts';

/**
 * Photo moderation (UC-36, UC-37, UC-39) against the real local Storage: approve/
 * hide/pending, event-scoped bulk updates that skip foreign IDs, and deletion of
 * the row plus all three objects.
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

type Organizer = { token: string; eventId: string; guestToken: string };

const setup = async (): Promise<Organizer> => {
  const email = unique('moderation');
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
  const wedding = (await onboarding.json()).wedding as { id: string };
  const guestResponse = await call(`/api/weddings/${wedding.id}/guests`, 'POST', { name: 'Jelena' }, token);
  const guest = (await guestResponse.json()).guest as { token: string };
  return { token, eventId: wedding.id, guestToken: guest.token };
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

const objectStatus = async (path: string): Promise<number> => {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/photos/${path}`, {
    method: 'HEAD',
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
  });
  return response.ok ? 200 : 404;
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

describe('PATCH /api/photos/:id (UC-36)', () => {
  it('approves, hides and returns a photo to pending; validates status and ownership', async () => {
    const owner = await setup();
    const other = await setup();
    const photo = await uploadOne(owner.guestToken);

    const approved = await call(`/api/photos/${photo.id}`, 'PATCH', { status: 'approved' }, owner.token);
    expect(approved.status).toBe(200);
    expect((await approved.json()).photo).toMatchObject({ id: photo.id, status: 'approved' });

    const hidden = await call(`/api/photos/${photo.id}`, 'PATCH', { status: 'hidden' }, owner.token);
    expect((await hidden.json()).photo.status).toBe('hidden');
    const pending = await call(`/api/photos/${photo.id}`, 'PATCH', { status: 'pending' }, owner.token);
    expect((await pending.json()).photo.status).toBe('pending');

    const invalid = await call(`/api/photos/${photo.id}`, 'PATCH', { status: 'uploading' }, owner.token);
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).code).toBe('badStatus');

    const missing = await call(
      '/api/photos/00000000-0000-4000-8000-000000000000',
      'PATCH',
      { status: 'approved' },
      owner.token,
    );
    expect(missing.status).toBe(404);

    const foreign = await call(`/api/photos/${photo.id}`, 'PATCH', { status: 'approved' }, other.token);
    expect(foreign.status).toBe(404);
    expect((await foreign.json()).code).toBe('photoNotFound');

    const unauthorized = await call(`/api/photos/${photo.id}`, 'PATCH', { status: 'approved' });
    expect(unauthorized.status).toBe(401);
  });
});

describe('POST /api/weddings/:id/photos/bulk-status (UC-37, SPEC §6.6 item 1)', () => {
  it('updates only the organizer’s event and silently skips foreign IDs', async () => {
    const owner = await setup();
    const other = await setup();
    const first = await uploadOne(owner.guestToken);
    const second = await uploadOne(owner.guestToken);
    const foreign = await uploadOne(other.guestToken);

    const response = await call(
      `/api/weddings/${owner.eventId}/photos/bulk-status`,
      'POST',
      {
        ids: [first.id, second.id, foreign.id],
        status: 'approved',
      },
      owner.token,
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.photos.map((photo: { id: string }) => photo.id).sort()).toEqual([first.id, second.id].sort());

    const [foreignRow] = await getDb().select().from(photos).where(eq(photos.id, foreign.id));
    expect(foreignRow?.status).toBe('pending');

    const invalid = await call(
      `/api/weddings/${owner.eventId}/photos/bulk-status`,
      'POST',
      {
        ids: [first.id],
        status: 'uploading',
      },
      owner.token,
    );
    expect((await invalid.json()).code).toBe('badStatus');

    const badIds = await call(
      `/api/weddings/${owner.eventId}/photos/bulk-status`,
      'POST',
      { ids: 'x', status: 'approved' },
      owner.token,
    );
    expect((await badIds.json()).code).toBe('badRequest');

    const foreignEvent = await call(
      `/api/weddings/${owner.eventId}/photos/bulk-status`,
      'POST',
      { ids: [], status: 'approved' },
      other.token,
    );
    expect(foreignEvent.status).toBe(404);
  });
});

describe('DELETE /api/photos/:id (UC-39)', () => {
  it('removes all three stored objects and the row; foreign photos stay untouched', async () => {
    const owner = await setup();
    const other = await setup();
    const photo = await uploadOne(owner.guestToken);
    const foreign = await uploadOne(other.guestToken);

    for (const path of photo.paths) expect(await objectStatus(path)).toBe(200);

    const foreignDelete = await call(`/api/photos/${photo.id}`, 'DELETE', undefined, other.token);
    expect(foreignDelete.status).toBe(404);
    for (const path of photo.paths) expect(await objectStatus(path)).toBe(200);

    const deleted = await call(`/api/photos/${photo.id}`, 'DELETE', undefined, owner.token);
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ id: photo.id });

    const remaining = await getDb().select().from(photos).where(eq(photos.id, photo.id));
    expect(remaining).toHaveLength(0);
    for (const path of photo.paths) expect(await objectStatus(path)).toBe(404);

    const again = await call(`/api/photos/${photo.id}`, 'DELETE', undefined, owner.token);
    expect(again.status).toBe(404);

    // The foreign photo and its files are intact.
    const [foreignRow] = await getDb().select().from(photos).where(eq(photos.id, foreign.id));
    expect(foreignRow?.id).toBe(foreign.id);
    for (const path of foreign.paths) expect(await objectStatus(path)).toBe(200);
  });
});
