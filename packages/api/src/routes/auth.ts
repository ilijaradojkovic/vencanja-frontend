import { Hono } from 'hono';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client.ts';
import { profiles } from '../db/schema.ts';
import { errorBody, type AppEnv } from '../http.ts';
import { getAuthUser, readBearerToken, tokenIssuedAt } from '../services/auth.ts';

export type ProfilePayload = {
  id: string;
  role: 'superadmin' | 'couple';
  email: string;
  name: string;
  phone: string;
  locale: 'sr' | 'en' | 'ru';
  active: boolean;
  onboardedAt: string | null;
  createdAt: string;
};

const toPayload = (profile: typeof profiles.$inferSelect): ProfilePayload => ({
  id: profile.id,
  role: profile.role,
  email: profile.email,
  name: profile.name,
  phone: profile.phone,
  locale: profile.locale,
  active: profile.active,
  onboardedAt: profile.onboardedAt?.toISOString() ?? null,
  createdAt: profile.createdAt.toISOString(),
});

/**
 * `GET /api/auth/me` — verifies the Supabase access token and returns the profile,
 * creating it on the first call (SPEC §6, M2). A token issued before
 * `tokens_valid_after` is rejected, so deactivation and password changes end
 * existing sessions immediately (`401`); `active = false` is rejected the same way.
 */
export const authRoutes = new Hono<AppEnv>().get('/auth/me', async (c) => {
  const token = readBearerToken(c.req.header('authorization'));
  if (!token) return c.json(errorBody(c, 'unauthorized'), 401);

  const user = await getAuthUser(token);
  if (!user) return c.json(errorBody(c, 'sessionExpired'), 401);

  const db = getDb();
  const [existing] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

  if (existing) {
    if (!existing.active) return c.json(errorBody(c, 'accountDisabled'), 401);
    const issuedAt = tokenIssuedAt(token);
    if (existing.tokensValidAfter && issuedAt !== null && issuedAt * 1000 < existing.tokensValidAfter.getTime()) {
      return c.json(errorBody(c, 'sessionExpired'), 401);
    }
    await db.update(profiles).set({ lastLoginAt: new Date() }).where(eq(profiles.id, user.id));
    return c.json({ profile: toPayload(existing) });
  }

  const [created] = await db
    .insert(profiles)
    .values({ id: user.id, email: user.email, name: user.name, locale: user.locale, lastLoginAt: new Date() })
    .onConflictDoUpdate({ target: profiles.id, set: { lastLoginAt: new Date() } })
    .returning();

  if (!created) return c.json(errorBody(c, 'internalError'), 500);
  return c.json({ profile: toPayload(created) }, 201);
});
