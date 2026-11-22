import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';
import { events, profiles } from '../src/db/schema.ts';

/**
 * Onboarding, the `409 onboardingRequired` guard and the password cutoff, against
 * the real local Supabase stack (DOD M2). Each test creates its own auth user.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const adminHeaders = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };

const created: string[] = [];
const password = 'integration-123';

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

const signIn = async (email: string, secret = password): Promise<string | null> => {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey || serviceKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: secret }),
  });
  if (!response.ok) return null;
  return ((await response.json()) as { access_token?: string }).access_token ?? null;
};

const call = (path: string, method: string, token?: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@uspomena.test`;

const wedding = (overrides: Record<string, unknown> = {}) => ({
  type: 'wedding',
  partner1: 'Željana',
  partner2: 'Nikola',
  date: '2027-06-12',
  phone: '064 123 4567',
  ...overrides,
});

const onboard = async (email: string) => {
  const id = await createUser(email);
  const token = await signIn(email);
  expect(token).toBeTruthy();
  return { id, token: token ?? '' };
};

afterAll(async () => {
  const db = getDb();
  for (const id of created) {
    await db.delete(profiles).where(eq(profiles.id, id));
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders });
  }
  await closeDb();
});

describe('POST /api/onboarding', () => {
  it('requires a valid token', async () => {
    const response = await call('/api/onboarding', 'POST', undefined, wedding());
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('unauthorized');
  });

  it('validates the body with the shared codes and creates nothing', async () => {
    const email = unique('onboarding-invalid');
    const { id, token } = await onboard(email);

    const invalidPhone = await call('/api/onboarding', 'POST', token, wedding({ phone: '123' }));
    expect(invalidPhone.status).toBe(422);
    expect((await invalidPhone.json()).code).toBe('invalidPhone');

    const missingDate = await call('/api/onboarding', 'POST', token, wedding({ date: '2027-02-31' }));
    expect(missingDate.status).toBe(422);
    expect((await missingDate.json()).code).toBe('dateRequired');

    const missingName = await call('/api/onboarding', 'POST', token, wedding({ partner2: '' }));
    expect(missingName.status).toBe(422);
    expect((await missingName.json()).code).toBe('namesRequired');

    const unknownType = await call('/api/onboarding', 'POST', token, wedding({ type: 'party' }));
    expect(unknownType.status).toBe(422);
    expect((await unknownType.json()).code).toBe('badRequest');

    const rows = await getDb().select().from(events).where(eq(events.ownerId, id));
    expect(rows).toHaveLength(0);
  });

  it('creates the event with defaults, stores the phone and finishes onboarding once', async () => {
    const email = unique('onboarding-wedding');
    const { id, token } = await onboard(email);

    const response = await call('/api/onboarding', 'POST', token, wedding());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.wedding).toMatchObject({
      type: 'wedding',
      slug: 'zeljana-i-nikola',
      partner1: 'Željana',
      partner2: 'Nikola',
      date: '2027-06-12',
      retentionMonths: 3,
      purgedAt: null,
    });
    expect(body.wedding.invitation).toMatchObject({ templateId: 'klasik', accentColor: '#2D4A3E' });
    expect(body.wedding.settings).toMatchObject({ autoApprovePhotos: false, galleryOpen: 'after_wedding' });
    // 2027-06-12 + 3 months at 00:00 Europe/Belgrade (02:00 in June) = 2027-09-11T22:00:00Z.
    expect(body.wedding.purgeAt).toBe('2027-09-11T22:00:00.000Z');
    expect(body.profile).toMatchObject({ phone: '+381641234567', name: 'Željana i Nikola' });
    expect(body.profile.onboardedAt).toBeTruthy();

    const current = await call('/api/weddings/current', 'GET', token);
    expect(current.status).toBe(200);
    expect((await current.json()).wedding.slug).toBe('zeljana-i-nikola');

    const again = await call('/api/onboarding', 'POST', token, wedding({ date: '2028-01-01' }));
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe('conflict');

    const rows = await getDb().select().from(events).where(eq(events.ownerId, id));
    expect(rows).toHaveLength(1);
  });

  it('creates a celebration with the occasion in the slug', async () => {
    const { token } = await onboard(unique('onboarding-celebration'));

    const response = await call('/api/onboarding', 'POST', token, {
      type: 'celebration',
      partner1: 'Luka',
      occasion: '18. rođendan',
      date: '2027-05-20',
      phone: '060 111 2222',
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    // A seeded fixture may already own the exact slug locally, so a numeric suffix is valid.
    expect(body.wedding.slug).toMatch(/^luka-18-rodjendan(-\d+)?$/);
    expect(body.wedding.occasion).toBe('18. rođendan');
  });
});

describe('onboarding guard', () => {
  it('answers 409 onboardingRequired on organizer data routes until onboarding is done', async () => {
    const { token } = await onboard(unique('guard'));

    const missing = await call('/api/weddings/current', 'GET');
    expect(missing.status).toBe(401);

    const guarded = await call('/api/weddings/current', 'GET', token);
    expect(guarded.status).toBe(409);
    expect((await guarded.json()).code).toBe('onboardingRequired');

    // The guard runs in front of the route tree for the whole prefix, not only for /weddings.
    const guests = await call('/api/guests', 'GET', token);
    expect(guests.status).toBe(409);

    await call('/api/onboarding', 'POST', token, wedding());
    const current = await call('/api/weddings/current', 'GET', token);
    expect(current.status).toBe(200);
  });
});

describe('POST /api/auth/password/complete', () => {
  it('rejects tokens issued before the cutoff and accepts a fresh session', async () => {
    const email = unique('password-cutoff');
    await createUser(email);
    const oldToken = (await signIn(email)) ?? '';
    expect(oldToken).toBeTruthy();

    // Make the old token's `iat` strictly older than the cutoff second.
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const complete = await call('/api/auth/password/complete', 'POST', oldToken);
    expect(complete.status).toBe(204);

    const rejected = await call('/api/auth/me', 'GET', oldToken);
    expect(rejected.status).toBe(401);
    expect((await rejected.json()).code).toBe('sessionExpired');

    const fresh = (await signIn(email)) ?? '';
    const accepted = await call('/api/auth/me', 'GET', fresh);
    expect(accepted.status).toBe(200);
  });
});
