import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';
import { profiles } from '../src/db/schema.ts';
import { SEED_USER_IDS } from '../src/db/fixtures.ts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const passwordToken = async (email: string, password: string): Promise<string | null> => {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey || serviceKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { access_token?: string };
  return body.access_token ?? null;
};

const me = (token?: string) =>
  app.request('/api/auth/me', { headers: token ? { authorization: `Bearer ${token}` } : {} });

afterAll(async () => {
  await closeDb();
});

describe('GET /api/auth/me', () => {
  beforeAll(async () => {
    const [profile] = await getDb().select().from(profiles).where(eq(profiles.id, SEED_USER_IDS.couple)).limit(1);
    expect(profile?.role).toBe('couple');
  });

  it('rejects a missing or invalid token', async () => {
    const missing = await me();
    const invalid = await me('not-a-jwt');

    expect(missing.status).toBe(401);
    expect((await missing.json()).code).toBe('unauthorized');
    expect(invalid.status).toBe(401);
    expect((await invalid.json()).code).toBe('sessionExpired');
  });

  it('returns the seeded profile for a valid access token', async () => {
    const token = await passwordToken('couple@uspomena.test', 'couple-local-123');
    expect(token).toBeTruthy();

    const response = await me(token ?? '');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.profile).toMatchObject({
      id: SEED_USER_IDS.couple,
      email: 'couple@uspomena.test',
      role: 'couple',
      active: true,
    });
    expect(body.profile.createdAt).toMatch(/T/);
  });

  it('creates the profile on the first call for a new auth user', async () => {
    const email = `first-call-${Date.now()}@uspomena.test`;
    const created = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'first-call-123', email_confirm: true, user_metadata: { locale: 'en' } }),
    });
    const user = (await created.json()) as { id: string };
    expect(user.id).toBeTruthy();

    const token = await passwordToken(email, 'first-call-123');
    const response = await me(token ?? '');
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.profile).toMatchObject({ id: user.id, email, locale: 'en', role: 'couple', active: true });

    await getDb().delete(profiles).where(eq(profiles.id, user.id));
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
    });
  });

  it('rejects a deactivated profile even with a valid token', async () => {
    const token = await passwordToken('inactive@uspomena.test', 'inactive-local-123');
    expect(token).toBeTruthy();

    const response = await me(token ?? '');
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('accountDisabled');
  });

  it('rejects tokens issued before tokens_valid_after', async () => {
    const token = await passwordToken('celebration@uspomena.test', 'celebration-local-123');
    expect(token).toBeTruthy();

    await getDb()
      .update(profiles)
      .set({ tokensValidAfter: new Date(Date.now() + 60_000) })
      .where(eq(profiles.id, SEED_USER_IDS.celebration));

    const response = await me(token ?? '');
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('sessionExpired');

    await getDb().update(profiles).set({ tokensValidAfter: null }).where(eq(profiles.id, SEED_USER_IDS.celebration));
  });
});
