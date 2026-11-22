import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { getDb } from '../db/client.ts';
import { profiles } from '../db/schema.ts';
import { errorBody, type AppEnv } from '../http.ts';
import { parseMePatch } from '../services/admin.ts';
import { readBearerToken } from '../services/auth.ts';
import { loadSession } from '../services/profiles.ts';

export type ProfilePayload = {
  id: string;
  role: 'superadmin' | 'couple';
  email: string;
  name: string;
  phone: string;
  locale: 'sr' | 'en' | 'ru';
  active: boolean;
  providers: string[];
  onboardedAt: string | null;
  termsAcceptedAt: string | null;
  createdAt: string;
};

export const toProfilePayload = (profile: typeof profiles.$inferSelect): ProfilePayload => ({
  id: profile.id,
  role: profile.role,
  email: profile.email,
  name: profile.name,
  phone: profile.phone,
  locale: profile.locale,
  active: profile.active,
  providers: [],
  onboardedAt: profile.onboardedAt?.toISOString() ?? null,
  termsAcceptedAt: profile.termsAcceptedAt?.toISOString() ?? null,
  createdAt: profile.createdAt.toISOString(),
});

/**
 * `GET /api/auth/me` — verifies the Supabase access token and returns the profile,
 * creating it on the first call (SPEC §6.1, M2). A token issued before
 * `tokens_valid_after` is rejected, so deactivation and password changes end
 * existing sessions immediately (`401`); `active = false` is rejected the same way.
 *
 * `POST /api/auth/password/complete` is called after a successful Supabase
 * password change plus `signOut({ scope: 'others' })` (UC-80, UC-83): it moves
 * `tokens_valid_after` forward so every already-issued access token is rejected.
 * The client then refreshes its own session to receive a post-cutoff token.
 */
export const authRoutes = new Hono<AppEnv>()
  .get('/auth/me', async (c) => {
    const token = readBearerToken(c.req.header('authorization'));
    if (!token) return c.json(errorBody(c, 'unauthorized'), 401);

    const session = await loadSession(token);
    if (!session.ok) return c.json(errorBody(c, session.code), 401);

    await getDb().update(profiles).set({ lastLoginAt: new Date() }).where(eq(profiles.id, session.profile.id));
    return c.json(
      { profile: { ...toProfilePayload(session.profile), providers: session.user.providers } },
      session.created ? 201 : 200,
    );
  })
  .patch('/auth/me', async (c) => {
    const token = readBearerToken(c.req.header('authorization'));
    if (!token) return c.json(errorBody(c, 'unauthorized'), 401);

    const session = await loadSession(token);
    if (!session.ok) return c.json(errorBody(c, session.code), 401);

    const input = (await c.req.json().catch(() => ({}))) as {
      name?: string;
      phone?: string;
      locale?: 'sr' | 'en' | 'ru';
    };
    const patch = parseMePatch(input);
    if (Object.keys(patch).length === 0) return c.json(errorBody(c, 'badRequest'), 422);

    const [profile] = await getDb().update(profiles).set(patch).where(eq(profiles.id, session.profile.id)).returning();
    if (!profile) return c.json(errorBody(c, 'internalError'), 500);
    return c.json({ profile: { ...toProfilePayload(profile), providers: session.user.providers } });
  })
  .post('/auth/password/complete', async (c) => {
    const token = readBearerToken(c.req.header('authorization'));
    if (!token) return c.json(errorBody(c, 'unauthorized'), 401);

    // Second precision, matching the JWT `iat` (SPEC §6.1): the cutoff is rounded
    // down, and `iat >= floor(epoch(tokens_valid_after))` stays valid.
    const session = await loadSession(token);
    if (!session.ok) return c.json(errorBody(c, session.code), 401);

    const cutoff = new Date(Math.floor(Date.now() / 1000) * 1000);
    await getDb().update(profiles).set({ tokensValidAfter: cutoff }).where(eq(profiles.id, session.profile.id));
    return c.body(null, 204);
  });
