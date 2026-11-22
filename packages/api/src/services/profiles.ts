import type { MessageKey } from '@uspomena/shared';
import { eq } from 'drizzle-orm';

import { getDb } from '../db/client.ts';
import { profiles } from '../db/schema.ts';
import { getAuthUser, tokenIssuedAt, type AuthUser } from './auth.ts';

export type ProfileRow = typeof profiles.$inferSelect;

export type Session =
  { ok: true; user: AuthUser; profile: ProfileRow; created: boolean } | { ok: false; code: MessageKey };

/**
 * The profile is created from the verified auth user on the first authenticated
 * call (SPEC §6.1). `tokens_valid_after` and `active` are enforced on every call,
 * so a deactivation or password change ends already-issued access tokens.
 */
export const ensureProfile = async (user: AuthUser): Promise<{ profile: ProfileRow; created: boolean }> => {
  const db = getDb();
  const [existing] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (existing) return { profile: existing, created: false };

  const [created] = await db
    .insert(profiles)
    .values({
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
      termsAcceptedAt: user.termsAcceptedAt,
      termsVersion: user.termsVersion,
      privacyVersion: user.privacyVersion,
    })
    .onConflictDoUpdate({ target: profiles.id, set: { email: user.email } })
    .returning();
  if (!created) throw new Error('Could not create the profile for a verified auth user.');
  return { profile: created, created: true };
};

const tokenIsValid = (profile: ProfileRow, token: string): boolean => {
  if (!profile.active) return false;
  const issuedAt = tokenIssuedAt(token);
  if (issuedAt === null || !profile.tokensValidAfter) return true;
  return issuedAt * 1000 >= profile.tokensValidAfter.getTime();
};

/** Verifies the token with Supabase Auth and loads (or bootstraps) its profile. */
export const loadSession = async (token: string): Promise<Session> => {
  const user = await getAuthUser(token);
  if (!user) return { ok: false, code: 'sessionExpired' };

  const { profile, created } = await ensureProfile(user);
  if (!profile.active) return { ok: false, code: 'accountDisabled' };
  if (!tokenIsValid(profile, token)) return { ok: false, code: 'sessionExpired' };
  return { ok: true, user, profile, created };
};

export const getProfileById = async (id: string): Promise<ProfileRow | null> => {
  const [profile] = await getDb().select().from(profiles).where(eq(profiles.id, id)).limit(1);
  return profile ?? null;
};
