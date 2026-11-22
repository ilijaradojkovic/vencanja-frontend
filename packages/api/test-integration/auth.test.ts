import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';
import { profiles } from '../src/db/schema.ts';

/**
 * Auth integration tests create their own auth users and profiles, so they run
 * against a freshly migrated database with no seed fixtures (CI included).
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const adminHeaders = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };

const created: string[] = [];

const createUser = async (email: string, locale = 'sr') => {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email, password: 'integration-123', email_confirm: true, user_metadata: { locale } }),
  });
  const user = (await response.json()) as { id: string };
  created.push(user.id);
  return user.id;
};

const passwordToken = async (email: string): Promise<string | null> => {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey || serviceKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'integration-123' }),
  });
  if (!response.ok) return null;
  return ((await response.json()) as { access_token?: string }).access_token ?? null;
};

const me = (token?: string) =>
  app.request('/api/auth/me', { headers: token ? { authorization: `Bearer ${token}` } : {} });

const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@uspomena.test`;

afterAll(async () => {
  const db = getDb();
  for (const id of created) {
    await db.delete(profiles).where(eq(profiles.id, id));
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders });
  }
  await closeDb();
});

describe('GET /api/auth/me', () => {
  it('rejects a missing or invalid token', async () => {
    const missing = await me();
    const invalid = await me('not-a-jwt');

    expect(missing.status).toBe(401);
    expect((await missing.json()).code).toBe('unauthorized');
    expect(invalid.status).toBe(401);
    expect((await invalid.json()).code).toBe('sessionExpired');
  });

  it('creates the profile on the first call and returns it afterwards', async () => {
    const email = unique('first-call');
    const id = await createUser(email, 'en');
    const token = await passwordToken(email);
    expect(token).toBeTruthy();

    const createdResponse = await me(token ?? '');
    const createdBody = await createdResponse.json();
    expect(createdResponse.status).toBe(201);
    expect(createdBody.profile).toMatchObject({
      id,
      email,
      locale: 'en',
      role: 'couple',
      active: true,
      onboardedAt: null,
    });

    const existingResponse = await me(token ?? '');
    expect(existingResponse.status).toBe(200);
    expect((await existingResponse.json()).profile.id).toBe(id);
  });

  it('rejects a deactivated profile even with a valid token', async () => {
    const email = unique('deactivated');
    const id = await createUser(email);
    await getDb().insert(profiles).values({ id, email, active: false, tokensValidAfter: new Date() });

    const token = await passwordToken(email);
    const response = await me(token ?? '');

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('accountDisabled');
  });

  it('rejects tokens issued before tokens_valid_after', async () => {
    const email = unique('revoked');
    const id = await createUser(email);
    const token = await passwordToken(email);

    await getDb()
      .insert(profiles)
      .values({ id, email, tokensValidAfter: new Date(Date.now() + 60_000) });

    const response = await me(token ?? '');
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('sessionExpired');
  });
});
