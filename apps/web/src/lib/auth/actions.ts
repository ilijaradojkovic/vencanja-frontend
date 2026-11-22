'use client';

import type { Language } from '@uspomena/shared';

import { apiFetch } from '@/lib/diagnostics/api';
import { getBrowserAuth } from './browser';

/** Legal-document versions accepted at signup (UC-77); the pages are drafted in M6. */
export const LEGAL_VERSIONS = { terms: '2026-11-22-draft', privacy: '2026-11-22-draft' } as const;

export type AuthProfile = {
  id: string;
  role: 'superadmin' | 'couple';
  email: string;
  name: string;
  phone: string;
  locale: Language;
  active: boolean;
  onboardedAt: string | null;
};

export type AuthResult = { ok: true; profile: AuthProfile } | { ok: false; message: string; code?: string };

const callbackUrl = (next: string): string =>
  typeof window === 'undefined' ? next : `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

/** Path after a successful sign-in: admin, onboarding or the organizer app. */
export const homePathFor = (profile: AuthProfile, next?: string | null): string => {
  if (profile.role === 'superadmin') return '/admin';
  if (!profile.onboardedAt) return '/onboarding';
  return next && next.startsWith('/app') ? next : '/app';
};

/** Loads the profile through the API, which is the authorization boundary (SPEC §3.3). */
export const loadProfile = async (): Promise<AuthResult> => {
  const response = await apiFetch('/api/auth/me');
  const body = (await response.json().catch(() => ({}))) as {
    profile?: AuthProfile;
    message?: string;
    code?: string;
  };
  if (!response.ok || !body.profile) {
    return { ok: false, message: body.message ?? 'Unauthorized', code: body.code };
  }
  return { ok: true, profile: body.profile };
};

export const signIn = async (email: string, password: string): Promise<AuthResult & { unverified?: boolean }> => {
  const auth = getBrowserAuth();
  if (!auth) return { ok: false, message: 'Supabase is not configured.' };

  const { error } = await auth.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    const unverified = error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message);
    return { ok: false, message: error.message, code: error.code, ...(unverified ? { unverified: true } : {}) };
  }
  return loadProfile();
};

export const signInWithGoogle = async (): Promise<{ ok: boolean; message?: string }> => {
  const auth = getBrowserAuth();
  if (!auth) return { ok: false, message: 'Supabase is not configured.' };
  const { error } = await auth.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl('/onboarding') },
  });
  return error ? { ok: false, message: error.message } : { ok: true };
};

export const signUp = async (input: {
  email: string;
  password: string;
  locale: Language;
}): Promise<{ ok: boolean; message?: string }> => {
  const auth = getBrowserAuth();
  if (!auth) return { ok: false, message: 'Supabase is not configured.' };

  const { error } = await auth.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: callbackUrl('/onboarding'),
      data: {
        locale: input.locale,
        termsVersion: LEGAL_VERSIONS.terms,
        privacyVersion: LEGAL_VERSIONS.privacy,
        termsAcceptedAt: new Date().toISOString(),
      },
    },
  });
  // An existing address must look exactly like a new one (UC-77): the caller shows
  // the same "check your email" screen and never reveals whether the account exists.
  return { ok: !error || error.code === 'user_already_exists', message: error?.message };
};

export const resendConfirmation = async (email: string): Promise<{ ok: boolean; message?: string }> => {
  const auth = getBrowserAuth();
  if (!auth) return { ok: false, message: 'Supabase is not configured.' };
  const { error } = await auth.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: callbackUrl('/onboarding') },
  });
  return { ok: !error, message: error?.message };
};

export const requestPasswordReset = async (email: string): Promise<{ ok: boolean; message?: string }> => {
  const auth = getBrowserAuth();
  if (!auth) return { ok: false, message: 'Supabase is not configured.' };
  const { error } = await auth.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: callbackUrl('/nova-lozinka'),
  });
  return { ok: !error, message: error?.message };
};

/**
 * UC-80/UC-83: change the password, revoke every other refresh session, tell the
 * API to move the access-token cutoff, then refresh this session so it receives a
 * post-cutoff token (old access tokens are rejected by the API).
 */
export const completePasswordChange = async (password: string): Promise<{ ok: boolean; message?: string }> => {
  const auth = getBrowserAuth();
  if (!auth) return { ok: false, message: 'Supabase is not configured.' };
  const email = (await auth.auth.getUser()).data.user?.email;
  if (!email) return { ok: false, message: 'Your session has expired. Please sign in again.' };

  const { error } = await auth.auth.updateUser({ password });
  if (error) return { ok: false, message: error.message };

  await auth.auth.signOut({ scope: 'others' });
  const response = await apiFetch('/api/auth/password/complete', { method: 'POST' });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    return { ok: false, message: body.message ?? 'Could not complete the password change.' };
  }
  // Re-authenticate with the password just set so the browser is guaranteed a
  // post-cutoff access token: refreshing a session that was created by a recovery
  // link can race the revocation of the other sessions.
  await auth.auth.signOut({ scope: 'local' });
  const { error: signInError } = await auth.auth.signInWithPassword({ email, password });
  if (signInError) return { ok: false, message: signInError.message };
  return { ok: true };
};

/**
 * UC-09 sign-out: clear this browser's session immediately. `scope: 'local'` keeps
 * the sign-out instant and offline-safe; revoking every device's refresh tokens is
 * not required by the use case and would make the button depend on Auth latency.
 */
export type ProfilePatch = { name?: string; phone?: string; locale?: Language };

/** `PATCH /auth/me` (UC-08 phone, UC-10 locale) through the API boundary. */
export const patchProfile = async (patch: ProfilePatch): Promise<AuthResult> => {
  const response = await apiFetch('/api/auth/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const body = (await response.json().catch(() => ({}))) as { profile?: AuthProfile; message?: string; code?: string };
  if (!response.ok || !body.profile) return { ok: false, message: body.message ?? 'Unauthorized', code: body.code };
  return { ok: true, profile: body.profile };
};

/** UC-82: Supabase Secure Email Change sends confirmation links to both addresses. */
export const changeEmail = async (
  email: string,
): Promise<{ ok: boolean; pending?: string | null; message?: string }> => {
  const auth = getBrowserAuth();
  if (!auth) return { ok: false, message: 'Supabase is not configured.' };
  const { error } = await auth.auth.updateUser({ email: email.trim() });
  if (error) return { ok: false, message: error.message };
  const { data } = await auth.auth.getUser();
  return { ok: true, pending: data.user?.new_email ?? null };
};

/** UC-83: the current password is verified before the password is changed. */
export const changePassword = async (
  current: string,
  next: string,
): Promise<{ ok: boolean; wrongCurrent?: boolean; message?: string }> => {
  const auth = getBrowserAuth();
  if (!auth) return { ok: false, message: 'Supabase is not configured.' };
  const email = (await auth.auth.getUser()).data.user?.email;
  if (!email) return { ok: false, message: 'Your session has expired. Please sign in again.' };

  const { error: check } = await auth.auth.signInWithPassword({ email, password: current });
  if (check) return { ok: false, wrongCurrent: true, message: check.message };

  const result = await completePasswordChange(next);
  return result.ok ? { ok: true } : { ok: false, message: result.message };
};

/** UC-83 for Google-only accounts: "Set password" sends the UC-80 email instead. */
export const sendSetPasswordEmail = requestPasswordReset;

/** UC-10: the `lang` cookie is what the server renders with; the profile keeps it too. */
export const setLocaleCookie = (locale: Language): void => {
  if (typeof document === 'undefined') return;
  document.cookie = `lang=${locale}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = locale;
};

export const signOut = async (): Promise<void> => {
  const auth = getBrowserAuth();
  await auth?.auth.signOut({ scope: 'local' }).catch(() => undefined);
};
