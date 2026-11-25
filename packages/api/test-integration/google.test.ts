import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';
import { profiles } from '../src/db/schema.ts';

/**
 * UC-79 at the local boundary: a Google identity fixture (an `auth.identities` row)
 * signs in and gets a profile with `providers: ['google']`, which is what makes
 * settings offer "Set password". Real Google OAuth configuration and delivery stay
 * an M7/M8 external check (DECISIONS.md).
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const adminHeaders = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };
const password = 'integration-123';
const created: string[] = [];

const unique = () => `google-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@uspomena.test`;

const createGoogleUser = async (): Promise<{ id: string; email: string }> => {
  const email = unique();
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { locale: 'sr' },
      app_metadata: { provider: 'google', providers: ['google'] },
    }),
  });
  const user = (await response.json()) as { id: string };
  created.push(user.id);

  await getDb().execute(sql`
    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(),
      ${user.id},
      jsonb_build_object('sub', ${user.id}::text, 'email', ${email}::text, 'email_verified', true),
      'google',
      ${user.id}::text,
      now(), now(), now()
    )
  `);
  return { id: user.id, email };
};

afterAll(async () => {
  const db = getDb();
  for (const id of created) {
    await db.delete(profiles).where(eq(profiles.id, id));
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders });
  }
  await closeDb();
});

describe('Google identity fixture (UC-79)', () => {
  it('creates the profile with the google provider so settings can offer "Set password"', async () => {
    const user = await createGoogleUser();

    const tokenResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: publishableKey || serviceKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email, password }),
    });
    expect(tokenResponse.ok).toBe(true);
    const token = ((await tokenResponse.json()) as { access_token?: string }).access_token ?? '';
    expect(token).toBeTruthy();

    const me = await app.request('/api/auth/me', { headers: { authorization: `Bearer ${token}` } });
    const body = await me.json();

    expect([200, 201]).toContain(me.status);
    expect(body.profile.id).toBe(user.id);
    expect(body.profile.providers).toEqual(['google']);
  });
});
