import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';
import { profiles } from '../src/db/schema.ts';

/**
 * `PATCH /api/weddings/:id` (M3): SPEC §6.6 validation, ownership and the
 * `purge_at` recalculation, against the real local database.
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
  const body = (await response.json()) as { access_token?: string };
  return body.access_token ?? '';
};

const call = (path: string, method: string, token: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

type Wedding = {
  id: string;
  slug: string;
  date: string;
  rsvpDeadline: string | null;
  city: string;
  purgeAt: string;
  invitation: { templateId: string; accentColor: string; headline: string; message: string; schedule: unknown[] };
  settings: Record<string, unknown>;
  type: string;
  partner1: string;
  partner2: string;
  occasion: string;
};

const organizer = async (input: Record<string, unknown> = {}): Promise<{ token: string; wedding: Wedding }> => {
  const email = unique('wedding');
  await createUser(email);
  const token = await signIn(email);
  const onboarding = await call('/api/onboarding', 'POST', token, {
    type: 'wedding',
    partner1: 'Ana',
    partner2: 'Marko',
    date: '2027-06-12',
    phone: '064 123 4567',
    ...input,
  });
  const body = await onboarding.json();
  return { token, wedding: body.wedding as Wedding };
};

const patch = async (token: string, id: string, body: unknown) => {
  const response = await call(`/api/weddings/${id}`, 'PATCH', token, body);
  return { response, body: await response.json() };
};

afterAll(async () => {
  const db = getDb();
  for (const id of created) {
    await db.delete(profiles).where(eq(profiles.id, id));
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders });
  }
  await closeDb();
});

describe('PATCH /api/weddings/:id', () => {
  it('updates a subset, merges invitation/settings and recalculates purge_at on a date change', async () => {
    const { token, wedding } = await organizer();

    const { response, body } = await patch(token, wedding.id, {
      slug: 'Ana-I-Marko-2027',
      city: 'Novi Sad',
      rsvpDeadline: '2027-05-20',
      invitation: { templateId: 'botanika', accentColor: '#3F5A48' },
      settings: { galleryOpen: 'manual', galleryManualOpen: true },
    });

    expect(response.status).toBe(200);
    expect(body.wedding).toMatchObject({
      slug: 'ana-i-marko-2027',
      city: 'Novi Sad',
      rsvpDeadline: '2027-05-20',
      invitation: { templateId: 'botanika', accentColor: '#3F5A48' },
      settings: { galleryOpen: 'manual', galleryManualOpen: true, galleryViaQr: true, autoApprovePhotos: false },
    });
    // The rest of the invitation is preserved by the partial merge.
    expect(body.wedding.invitation.headline).toBe('Venčavamo se');
    expect(body.wedding.invitation.schedule.length).toBeGreaterThan(0);
    expect(body.wedding.purgeAt).toBe(wedding.purgeAt);

    const moved = await patch(token, wedding.id, { date: '2027-07-01', rsvpDeadline: null });
    expect(moved.response.status).toBe(200);
    expect(moved.body.wedding.rsvpDeadline).toBeNull();
    // 2027-07-01 + 3 months at 00:00 Europe/Belgrade (02:00 in July).
    expect(moved.body.wedding.purgeAt).toBe('2027-09-30T22:00:00.000Z');
  });

  it('validates the slug format and uniqueness', async () => {
    const first = await organizer();
    const second = await organizer({ partner1: 'Mila', partner2: 'Nikola', slug: undefined });

    const bad = await patch(first.token, first.wedding.id, { slug: 'Bad Slug!' });
    expect(bad.response.status).toBe(422);
    expect(bad.body.code).toBe('badSlug');

    const taken = await patch(first.token, first.wedding.id, { slug: second.wedding.slug });
    expect(taken.response.status).toBe(422);
    expect(taken.body.code).toBe('badSlug');

    const own = await patch(first.token, first.wedding.id, { slug: first.wedding.slug });
    expect(own.response.status).toBe(200);
  });

  it('validates invitation fields (template, color, schedule, text lengths, unknown keys)', async () => {
    const { token, wedding } = await organizer();

    const template = await patch(token, wedding.id, { invitation: { templateId: 'custom' } });
    expect(template.body.code).toBe('badTemplate');

    const color = await patch(token, wedding.id, { invitation: { accentColor: '#abc' } });
    expect(color.body.code).toBe('badColor');

    const schedule = await patch(token, wedding.id, { invitation: { schedule: [{ time: '25:00', title: 'X' }] } });
    expect(schedule.body.code).toBe('badSchedule');

    const missingTitle = await patch(token, wedding.id, { invitation: { schedule: [{ time: '17:00', title: ' ' }] } });
    expect(missingTitle.body.code).toBe('badSchedule');

    const tooMany = await patch(token, wedding.id, {
      invitation: { schedule: Array.from({ length: 21 }, () => ({ time: '17:00', title: 'X' })) },
    });
    expect(tooMany.body.code).toBe('tooManyScheduleItems');
    expect(tooMany.response.status).toBe(422);

    const headline = await patch(token, wedding.id, { invitation: { headline: 'x'.repeat(201) } });
    expect(headline.body.code).toBe('textTooLong');

    const message = await patch(token, wedding.id, { invitation: { message: 'x'.repeat(2001) } });
    expect(message.body.code).toBe('textTooLong');

    const unknown = await patch(token, wedding.id, { invitation: { fontFamily: 'Comic Sans' } });
    expect(unknown.body.code).toBe('badRequest');

    const valid = await patch(token, wedding.id, {
      invitation: {
        headline: 'Naš dan',
        message: 'Pozivamo vas.',
        schedule: [
          { id: 'e1', time: '17:00', title: 'Ceremonija', place: 'Crkva', mapUrl: 'https://maps.example.com/x' },
        ],
      },
    });
    expect(valid.response.status).toBe(200);
    expect(valid.body.wedding.invitation).toMatchObject({
      headline: 'Naš dan',
      message: 'Pozivamo vas.',
      schedule: [{ id: 'e1', time: '17:00', title: 'Ceremonija', place: 'Crkva' }],
    });
  });

  it('validates settings keys, types and the gallery mode', async () => {
    const { token, wedding } = await organizer();

    const mode = await patch(token, wedding.id, { settings: { galleryOpen: 'sometimes' } });
    expect(mode.body.code).toBe('badGalleryMode');

    const unknown = await patch(token, wedding.id, { settings: { theme: 'dark' } });
    expect(unknown.body.code).toBe('badSettings');

    const wrongType = await patch(token, wedding.id, { settings: { autoApprovePhotos: 'yes' } });
    expect(wrongType.body.code).toBe('badSettings');

    const valid = await patch(token, wedding.id, { settings: { autoApprovePhotos: true, allowGeneralUpload: false } });
    expect(valid.response.status).toBe(200);
    expect(valid.body.wedding.settings).toMatchObject({ autoApprovePhotos: true, allowGeneralUpload: false });
  });

  it('rejects empty, unknown and invalid fields', async () => {
    const { token, wedding } = await organizer();

    const empty = await patch(token, wedding.id, {});
    expect(empty.response.status).toBe(422);
    expect(empty.body.code).toBe('badRequest');

    const unknown = await patch(token, wedding.id, { type: 'celebration' });
    expect(unknown.body.code).toBe('badRequest');

    const date = await patch(token, wedding.id, { date: '2027-02-31' });
    expect(date.body.code).toBe('dateRequired');

    const deadline = await patch(token, wedding.id, { rsvpDeadline: 'nije-datum' });
    expect(deadline.body.code).toBe('badDeadline');

    const noPartner = await patch(token, wedding.id, { partner2: '' });
    expect(noPartner.body.code).toBe('namesRequired');

    const longCity = await patch(token, wedding.id, { city: 'x'.repeat(121) });
    expect(longCity.body.code).toBe('textTooLong');
  });

  it('answers 404 for another organizer’s event and for an unknown id', async () => {
    const owner = await organizer();
    const other = await organizer({ partner1: 'Mila', partner2: 'Nikola' });

    const foreign = await patch(other.token, owner.wedding.id, { city: 'Beograd' });
    expect(foreign.response.status).toBe(404);
    expect(foreign.body.code).toBe('weddingNotFound');

    const unknown = await patch(other.token, '00000000-0000-4000-8000-000000000000', { city: 'Beograd' });
    expect(unknown.response.status).toBe(404);

    const unauthorized = await call(`/api/weddings/${owner.wedding.id}`, 'PATCH', '', { city: 'Beograd' });
    expect(unauthorized.status).toBe(401);
  });

  it('handles celebration-specific fields', async () => {
    const { token, wedding } = await organizer({
      type: 'celebration',
      partner1: 'Luka',
      partner2: '',
      occasion: '18. rođendan',
      date: '2027-05-20',
      phone: '060 111 2222',
    });

    const updated = await patch(token, wedding.id, { occasion: '19. rođendan', partner2: '' });
    expect(updated.response.status).toBe(200);
    expect(updated.body.wedding.occasion).toBe('19. rođendan');

    const noCelebrant = await patch(token, wedding.id, { partner1: '' });
    expect(noCelebrant.body.code).toBe('celebrantRequired');
  });
});
