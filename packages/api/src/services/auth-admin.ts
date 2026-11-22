import { randomInt } from 'node:crypto';
import { sql } from 'drizzle-orm';

import { getDb } from '../db/client.ts';
import { env } from '../env.ts';

/**
 * Thin Supabase Auth admin boundary (SPEC §6.2, UC-72 – UC-76). Only the API uses
 * it, with the service-role key; the browser never sees it.
 */
export type AdminAuthUser = {
  id: string;
  email: string;
  providers: string[];
};

const adminHeaders = (): Record<string, string> => ({
  apikey: env.supabaseServiceKey(),
  authorization: `Bearer ${env.supabaseServiceKey()}`,
  'content-type': 'application/json',
});

const adminUrl = (path: string): string => `${env.supabaseUrl()}/auth/v1/admin${path}`;

export type AuthAdminError = { code: string; message: string };

const parseError = async (response: Response): Promise<AuthAdminError> => {
  const body = (await response.json().catch(() => ({}))) as { error_code?: string; msg?: string; message?: string };
  return {
    code: body.error_code ?? `http_${response.status}`,
    message: body.msg ?? body.message ?? `Supabase Auth responded ${response.status}.`,
  };
};

/** 10 characters, unambiguous alphabet, from a cryptographic RNG (UC-72/UC-74). */
export const generatePassword = (): string => {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join('');
};

export const authAdminUser = async (id: string): Promise<AdminAuthUser | null> => {
  const response = await fetch(adminUrl(`/users/${id}`), { headers: adminHeaders() });
  if (!response.ok) return null;
  const user = (await response.json()) as { id: string; email: string; app_metadata?: { providers?: string[] } };
  return { id: user.id, email: user.email, providers: user.app_metadata?.providers ?? [] };
};

/** One call instead of an N+1 lookup for the admin account list. */
export const listAuthProviders = async (): Promise<Map<string, string[]>> => {
  const response = await fetch(adminUrl('/users?per_page=1000'), { headers: adminHeaders() });
  if (!response.ok) return new Map();
  const body = (await response.json()) as {
    users?: { id: string; app_metadata?: { providers?: string[] } }[];
  };
  return new Map((body.users ?? []).map((user) => [user.id, user.app_metadata?.providers ?? []]));
};

export const createAuthUser = async (input: {
  email: string;
  password: string;
  locale: 'sr' | 'en' | 'ru';
}): Promise<{ user: AdminAuthUser } | { error: AuthAdminError }> => {
  const response = await fetch(adminUrl('/users'), {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { locale: input.locale },
    }),
  });
  if (!response.ok) return { error: await parseError(response) };
  const user = (await response.json()) as { id: string; email: string; app_metadata?: { providers?: string[] } };
  return { user: { id: user.id, email: user.email, providers: user.app_metadata?.providers ?? [] } };
};

export const updateAuthUser = async (
  id: string,
  patch: { email?: string; password?: string; banDuration?: 'none' | string },
): Promise<{ ok: true } | { error: AuthAdminError }> => {
  const body: Record<string, unknown> = {};
  if (patch.email) {
    body.email = patch.email;
    body.email_confirm = true;
  }
  if (patch.password) body.password = patch.password;
  if (patch.banDuration) body.ban_duration = patch.banDuration;

  const response = await fetch(adminUrl(`/users/${id}`), {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify(body),
  });
  return response.ok ? { ok: true } : { error: await parseError(response) };
};

export const deleteAuthUser = async (id: string): Promise<boolean> => {
  const response = await fetch(adminUrl(`/users/${id}`), { method: 'DELETE', headers: adminHeaders() });
  return response.ok || response.status === 404;
};

/**
 * Revokes every refresh session of a user. GoTrue has no admin endpoint for this,
 * so the API deletes the user's rows in the Supabase Auth tables; already-issued
 * access tokens are rejected separately through `tokens_valid_after`.
 */
export const revokeAuthSessions = async (userId: string): Promise<void> => {
  const db = getDb();
  await db.execute(sql`delete from auth.refresh_tokens where user_id = ${userId}`);
  await db.execute(sql`delete from auth.sessions where user_id = ${userId}`);
};
