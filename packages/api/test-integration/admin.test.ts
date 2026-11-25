import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';
import { events, photos, profiles } from '../src/db/schema.ts';

/**
 * Admin account management, session revocation and the profile patch against the
 * real local Supabase stack (DOD M2, UC-71 – UC-76, S12).
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const adminHeaders = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };

const created: string[] = [];
const password = 'integration-123';
const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@uspomena.test`;

const createAuthUser = async (email: string): Promise<string> => {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { locale: 'sr' } }),
  });
  const user = (await response.json()) as { id: string };
  created.push(user.id);
  return user.id;
};

const signIn = async (email: string, secret = password): Promise<{ access?: string; refresh?: string } | null> => {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey || serviceKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: secret }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { access_token?: string; refresh_token?: string };
  return { access: body.access_token, refresh: body.refresh_token };
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

const superadmin = async (): Promise<string> => {
  const email = unique('super');
  const id = await createAuthUser(email);
  await getDb().insert(profiles).values({ id, role: 'superadmin', email, name: 'Admin', onboardedAt: new Date() });
  const session = await signIn(email);
  expect(session?.access).toBeTruthy();
  return session?.access ?? '';
};

const admin = (method: string, path: string, token: string, body?: unknown) =>
  call(`/api/admin${path}`, method, token, body);

const eventDraft = (overrides: Record<string, unknown> = {}) => ({
  type: 'celebration',
  partner1: 'Luka',
  occasion: '18. rođendan',
  date: '2027-05-20',
  email: unique('child'),
  phone: '060 111 2222',
  ...overrides,
});

afterAll(async () => {
  const db = getDb();
  for (const id of created) {
    await db.delete(profiles).where(eq(profiles.id, id));
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders });
  }
  await closeDb();
});

describe('admin authorization', () => {
  it('answers 401 without a token and 403 for an organizer', async () => {
    const missing = await call('/api/admin/accounts', 'GET');
    expect(missing.status).toBe(401);

    const email = unique('not-admin');
    const id = await createAuthUser(email);
    await getDb().insert(profiles).values({ id, email, onboardedAt: new Date() });
    const session = await signIn(email);
    const forbidden = await admin('GET', '/accounts', session?.access ?? '');
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).code).toBe('adminOnly');
  });
});

describe('POST /api/admin/accounts (UC-72)', () => {
  it('creates the Auth user, profile and celebration with a generated password', async () => {
    const token = await superadmin();
    const draft = eventDraft({ partner1: 'Mila', occasion: '18. rođendan' });

    const response = await admin('POST', '/accounts', token, draft);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.password).toHaveLength(10);
    expect(body.account).toMatchObject({
      email: draft.email,
      phone: '+381601112222',
      active: true,
      onboarded: true,
      providers: ['email'],
    });
    expect(body.account.wedding.slug).toMatch(/^mila-18-rodjendan(-\d+)?$/);
    expect(body.account.wedding.guestCount).toBe(0);

    const signInWithGenerated = await signIn(draft.email, body.password);
    expect(signInWithGenerated?.access).toBeTruthy();

    const list = await admin('GET', '/accounts', token);
    const accounts = (await list.json()).accounts as { id: string }[];
    expect(accounts.some((account) => account.id === body.account.id)).toBe(true);
  });

  it('validates the same rules as onboarding and rejects a taken email', async () => {
    const token = await superadmin();

    const missingCelebrant = await admin('POST', '/accounts', token, eventDraft({ partner1: '' }));
    expect(missingCelebrant.status).toBe(422);
    expect((await missingCelebrant.json()).code).toBe('celebrantRequired');

    const badPhone = await admin('POST', '/accounts', token, eventDraft({ phone: '12' }));
    expect((await badPhone.json()).code).toBe('invalidPhone');

    const badDate = await admin('POST', '/accounts', token, eventDraft({ date: '2027-02-31' }));
    expect((await badDate.json()).code).toBe('celebrationDateRequired');

    const first = await admin('POST', '/accounts', token, eventDraft({ email: unique('taken') }));
    const firstBody = await first.json();
    const duplicate = await admin('POST', '/accounts', token, eventDraft({ email: firstBody.account.email }));
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).code).toBe('emailTaken');
  });
});

describe('PATCH /api/admin/accounts/:id (UC-73, UC-75)', () => {
  it('changes type, names, phone and email and recalculates purge_at on a date change', async () => {
    const token = await superadmin();
    const createdAccount = await (
      await admin('POST', '/accounts', token, eventDraft({ email: unique('edit'), password }))
    ).json();

    const missingNames = await admin('PATCH', `/accounts/${createdAccount.account.id}`, token, { type: 'wedding' });
    expect(missingNames.status).toBe(422);
    expect((await missingNames.json()).code).toBe('namesRequired');

    const updated = await admin('PATCH', `/accounts/${createdAccount.account.id}`, token, {
      type: 'wedding',
      partner1: 'Ana',
      partner2: 'Marko',
      date: '2027-07-01',
      phone: '064 123 4567',
      email: unique('edit-new'),
    });
    const body = await updated.json();

    expect(updated.status).toBe(200);
    expect(body.account.wedding).toMatchObject({
      type: 'wedding',
      partner1: 'Ana',
      partner2: 'Marko',
      occasion: '',
      date: '2027-07-01',
    });
    expect(body.account.phone).toBe('+381641234567');
    // 2027-07-01 + 3 months at 00:00 Europe/Belgrade (02:00 in July) = 2027-09-30T22:00:00Z.
    expect(body.account.wedding.purgeAt).toBe('2027-09-30T22:00:00.000Z');

    const newEmailSignIn = await signIn(body.account.email);
    expect(newEmailSignIn?.access).toBeTruthy();
    const oldEmailSignIn = await signIn(createdAccount.account.email);
    expect(oldEmailSignIn).toBeNull();
  });

  it('deactivates and reactivates, ending sessions both ways (UC-75)', async () => {
    const token = await superadmin();
    const createdAccount = await (
      await admin('POST', '/accounts', token, eventDraft({ email: unique('deactivate') }))
    ).json();
    const session = await signIn(createdAccount.account.email, createdAccount.password);
    expect(session?.access).toBeTruthy();

    const deactivated = await admin('PATCH', `/accounts/${createdAccount.account.id}`, token, { active: false });
    expect(deactivated.status).toBe(200);
    expect((await deactivated.json()).account.active).toBe(false);

    const oldToken = await call('/api/auth/me', 'GET', session?.access ?? '');
    expect(oldToken.status).toBe(401);
    expect((await oldToken.json()).code).toBe('accountDisabled');

    const blocked = await signIn(createdAccount.account.email, createdAccount.password);
    expect(blocked).toBeNull();

    const activated = await admin('PATCH', `/accounts/${createdAccount.account.id}`, token, { active: true });
    expect((await activated.json()).account.active).toBe(true);
    const allowed = await signIn(createdAccount.account.email, createdAccount.password);
    expect(allowed?.access).toBeTruthy();
  });
});

describe('POST /api/admin/accounts/:id/password (UC-74)', () => {
  it('sets a new password, revokes refresh sessions and rejects old access tokens', async () => {
    const token = await superadmin();
    const createdAccount = await (
      await admin('POST', '/accounts', token, eventDraft({ email: unique('reset') }))
    ).json();
    const session = await signIn(createdAccount.account.email, createdAccount.password);
    expect(session?.refresh).toBeTruthy();

    const response = await admin('POST', `/accounts/${createdAccount.account.id}/password`, token, {});
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.password).toHaveLength(10);

    const oldToken = await call('/api/auth/me', 'GET', session?.access ?? '');
    expect(oldToken.status).toBe(401);
    expect((await oldToken.json()).code).toBe('sessionExpired');

    const oldPassword = await signIn(createdAccount.account.email, createdAccount.password);
    expect(oldPassword).toBeNull();
    const newPassword = await signIn(createdAccount.account.email, body.password);
    expect(newPassword?.access).toBeTruthy();

    const refresh = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: publishableKey || serviceKey, 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: session?.refresh }),
    });
    expect(refresh.ok).toBe(false);
  });
});

describe('DELETE /api/admin/accounts/:id (UC-76)', () => {
  it('removes the Auth user, profile, event and stored files', async () => {
    const token = await superadmin();
    const draft = eventDraft({ email: unique('delete') });
    const createdAccount = await (await admin('POST', '/accounts', token, draft)).json();
    const eventId = createdAccount.account.wedding.id as string;
    const path = `events/${eventId}/original/${createdAccount.account.id}.jpg`;

    const upload = await fetch(`${supabaseUrl}/storage/v1/object/photos/${path}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        'content-type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    expect(upload.ok).toBe(true);
    await getDb().insert(photos).values({
      eventId,
      status: 'approved',
      originalPath: path,
      webPath: null,
      thumbPath: null,
      mime: 'image/jpeg',
      sizeBytes: 4,
    });

    const response = await admin('DELETE', `/accounts/${createdAccount.account.id}`, token);
    expect(response.status).toBe(200);

    const remaining = await getDb().select().from(profiles).where(eq(profiles.id, createdAccount.account.id));
    expect(remaining).toHaveLength(0);
    const remainingEvents = await getDb().select().from(events).where(eq(events.ownerId, createdAccount.account.id));
    expect(remainingEvents).toHaveLength(0);

    const authUser = await fetch(`${supabaseUrl}/auth/v1/admin/users/${createdAccount.account.id}`, {
      headers: adminHeaders,
    });
    expect(authUser.status).toBe(404);

    const object = await fetch(`${supabaseUrl}/storage/v1/object/photos/${path}`, {
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
    });
    expect(object.ok).toBe(false);
  });
});

describe('PATCH /api/auth/me (UC-08, UC-10)', () => {
  it('saves the phone and locale, rejects an invalid or cleared phone', async () => {
    const email = unique('me-patch');
    const id = await createAuthUser(email);
    await getDb().insert(profiles).values({ id, email, onboardedAt: new Date() });
    const session = await signIn(email);

    const invalid = await call('/api/auth/me', 'PATCH', session?.access ?? '', { phone: '123' });
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).code).toBe('invalidPhone');

    const cleared = await call('/api/auth/me', 'PATCH', session?.access ?? '', { phone: '' });
    expect(cleared.status).toBe(422);

    const empty = await call('/api/auth/me', 'PATCH', session?.access ?? '', {});
    expect(empty.status).toBe(422);

    const updated = await call('/api/auth/me', 'PATCH', session?.access ?? '', { phone: '064 123 4567', locale: 'en' });
    const body = await updated.json();
    expect(updated.status).toBe(200);
    expect(body.profile).toMatchObject({ phone: '+381641234567', locale: 'en' });
  });
});
