import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';
import { events, photos, profiles } from '../src/db/schema.ts';

/**
 * Signed upload flow against the real local Storage (SPEC §6.3, M4): upload URL,
 * direct PUT, complete with the secret key, idempotency, real dimensions, storage
 * reservations/limits and the auto-approve rule.
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
  const email = unique('upload-owner');
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

describe('POST /public/invitations/:token/uploads (SPEC §6.3)', () => {
  it('reserves the declared bytes, returns a signed URL and completes a real image', async () => {
    const { guest } = await setup();
    const buffer = await image('jpeg');
    const response = await requestUploads(guest.token, [
      { name: 'slika.jpg', type: 'image/jpeg', size: buffer.byteLength },
    ]);
    const body = (await response.json()) as { uploads: { photoId: string; uploadUrl: string; uploadKey: string }[] };

    expect(response.status).toBe(201);
    expect(body.uploads).toHaveLength(1);
    const ticket = body.uploads[0];
    expect(ticket).toBeTruthy();
    expect(ticket?.uploadUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:54321\/storage\/v1\/object\/upload\/sign\/photos\/events\/.+\/original\/.+\.jpg\?token=/,
    );
    expect(ticket?.uploadKey).toMatch(/^[A-Za-z0-9_-]{40,}$/);

    const [row] = await getDb()
      .select()
      .from(photos)
      .where(eq(photos.id, ticket?.photoId ?? ''));
    expect(row).toMatchObject({ status: 'uploading', mime: 'image/jpeg', width: null, height: null });
    expect(row?.sizeBytes).toBe(buffer.byteLength);
    expect(row?.uploadKeyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.uploadKeyHash).not.toBe(ticket?.uploadKey);
    uploaded.push(row?.originalPath ?? '');

    const put = await putObject(ticket?.uploadUrl ?? '', buffer, 'image/jpeg');
    expect(put.ok).toBe(true);

    const completed = await complete(ticket?.photoId ?? '', ticket?.uploadKey ?? '');
    const completedBody = await completed.json();
    expect(completed.status).toBe(200);
    expect(completedBody).toEqual({ id: ticket?.photoId, status: 'pending' });

    const [processed] = await getDb()
      .select()
      .from(photos)
      .where(eq(photos.id, ticket?.photoId ?? ''));
    expect(processed).toMatchObject({ status: 'pending', mime: 'image/jpeg', width: 240, height: 180 });
    expect(processed?.uploadedAt).toBeTruthy();
    expect(processed?.sizeBytes).toBe(buffer.byteLength);

    // Idempotent: a second complete returns the current state without reprocessing.
    const again = await complete(ticket?.photoId ?? '', ticket?.uploadKey ?? '');
    expect(await again.json()).toEqual({ id: ticket?.photoId, status: 'pending' });
  });

  it('answers 404 for a wrong key and 422 when the object never arrived', async () => {
    const { guest } = await setup();
    const buffer = await image('png');
    const ticket = (
      await (await requestUploads(guest.token, [{ name: 'a.png', type: 'image/png', size: buffer.byteLength }])).json()
    ).uploads[0] as { photoId: string; uploadUrl: string; uploadKey: string };

    const wrong = await complete(ticket.photoId, 'not-the-key');
    expect(wrong.status).toBe(404);
    expect((await wrong.json()).code).toBe('photoNotFound');

    const missing = await complete(ticket.photoId, ticket.uploadKey);
    expect(missing.status).toBe(422);
    expect((await missing.json()).code).toBe('uploadNotFound');

    const [row] = await getDb().select().from(photos).where(eq(photos.id, ticket.photoId));
    expect(row?.status).toBe('uploading');
  });

  it('applies the EXIF orientation to the derivatives', async () => {
    const { guest } = await setup();
    const buffer = await sharp({
      create: { width: 240, height: 180, channels: 3, background: { r: 10, g: 120, b: 200 } },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Copyright: 'test' }, GPS: { GPSLatitudeRef: 'N' } })
      .toBuffer();

    const ticket = (
      await (
        await requestUploads(guest.token, [{ name: 'rot.jpg', type: 'image/jpeg', size: buffer.byteLength }])
      ).json()
    ).uploads[0] as { photoId: string; uploadUrl: string; uploadKey: string };
    await putObject(ticket.uploadUrl, buffer, 'image/jpeg');
    expect((await complete(ticket.photoId, ticket.uploadKey)).status).toBe(200);

    const [row] = await getDb().select().from(photos).where(eq(photos.id, ticket.photoId));
    uploaded.push(row?.originalPath ?? '', row?.webPath ?? '', row?.thumbPath ?? '');
    const web = await fetch(`${supabaseUrl}/storage/v1/object/photos/${row?.webPath}`, {
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
    });
    const metadata = await sharp(Buffer.from(await web.arrayBuffer())).metadata();
    expect(metadata.width).toBe(180);
    expect(metadata.height).toBe(240);
    expect(metadata.exif).toBeUndefined();
  });

  it('deletes an unreadable object and its row (notImage)', async () => {
    const { guest } = await setup();
    const fake = Buffer.from('this is definitely not an image');
    const ticket = (
      await (
        await requestUploads(guest.token, [{ name: 'fake.jpg', type: 'image/jpeg', size: fake.byteLength }])
      ).json()
    ).uploads[0] as { photoId: string; uploadUrl: string; uploadKey: string };

    await putObject(ticket.uploadUrl, fake, 'image/jpeg');
    const response = await complete(ticket.photoId, ticket.uploadKey);
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe('notImage');

    const remaining = await getDb().select().from(photos).where(eq(photos.id, ticket.photoId));
    expect(remaining).toHaveLength(0);
  });

  it('validates file count, type and declared size', async () => {
    const { guest } = await setup();

    const none = await requestUploads(guest.token, []);
    expect((await none.json()).code).toBe('noFiles');

    const tooMany = await requestUploads(
      guest.token,
      Array.from({ length: 51 }, (_, i) => ({ name: `${i}.jpg`, type: 'image/jpeg', size: 1000 })),
    );
    expect((await tooMany.json()).code).toBe('tooManyFiles');

    const text = await requestUploads(guest.token, [{ name: 'notes.txt', type: 'text/plain', size: 10 }]);
    expect(text.status).toBe(422);
    expect((await text.json()).code).toBe('notImage');

    const tooLarge = await requestUploads(guest.token, [
      { name: 'big.jpg', type: 'image/jpeg', size: 31 * 1024 * 1024 },
    ]);
    expect(tooLarge.status).toBe(422);
    expect((await tooLarge.json()).code).toBe('tooLarge');
  });

  it('blocks an upload batch over the storage limit and counts concurrent requests atomically', async () => {
    const { guest, eventId } = await setup();
    await getDb().update(events).set({ storageLimitBytes: 10_000 }).where(eq(events.id, eventId));

    const over = await requestUploads(guest.token, [{ name: 'a.jpg', type: 'image/jpeg', size: 11_000 }]);
    expect(over.status).toBe(403);
    expect((await over.json()).code).toBe('storageLimit');

    const batch = () => requestUploads(guest.token, [{ name: 'b.jpg', type: 'image/jpeg', size: 6_000 }]);
    const [first, second] = await Promise.all([batch(), batch()]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 403]);
  });

  it('auto-approves when the event setting is on (SYS-2)', async () => {
    const { guest } = await setup({ autoApprovePhotos: true });
    const buffer = await image('webp');
    const ticket = (
      await (
        await requestUploads(guest.token, [{ name: 'a.webp', type: 'image/webp', size: buffer.byteLength }])
      ).json()
    ).uploads[0] as { photoId: string; uploadUrl: string; uploadKey: string };
    uploaded.push((await getDb().select().from(photos).where(eq(photos.id, ticket.photoId)))[0]?.originalPath ?? '');

    await putObject(ticket.uploadUrl, buffer, 'image/webp');
    const completed = await complete(ticket.photoId, ticket.uploadKey);
    expect(await completed.json()).toEqual({ id: ticket.photoId, status: 'approved' });
  });
});

describe('POST /public/weddings/:slug/uploads', () => {
  it('is blocked when QR uploads are disabled but the personal link keeps working', async () => {
    const { guest, slug } = await setup({ allowGeneralUpload: false });

    const qr = await call(`/api/public/weddings/${slug}/uploads`, 'POST', {
      files: [{ name: 'a.jpg', type: 'image/jpeg', size: 1000 }],
    });
    expect(qr.status).toBe(403);
    expect((await qr.json()).code).toBe('qrUploadDisabled');

    const personal = await requestUploads(guest.token, [{ name: 'a.jpg', type: 'image/jpeg', size: 1000 }]);
    expect(personal.status).toBe(201);

    const missing = await call('/api/public/weddings/ne-postoji/uploads', 'POST', { files: [] });
    expect(missing.status).toBe(404);
  });
});
