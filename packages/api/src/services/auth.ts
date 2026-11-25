import { parseLanguage, type Language } from '@uspomena/shared';

import { env } from '../env.ts';

export type AuthUser = {
  id: string;
  email: string;
  locale: Language;
  name: string;
  /** Accepted legal documents from the signup metadata (UC-77); null when absent. */
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  privacyVersion: string | null;
  /** Identity providers, used by settings to offer "Set password" for Google accounts. */
  providers: string[];
};

const decodePayload = (token: string): Record<string, unknown> | null => {
  const [, payload] = token.split('.');
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/** Seconds since epoch when the token was issued, or null when it cannot be read. */
export const tokenIssuedAt = (token: string): number | null => {
  const issuedAt = decodePayload(token)?.iat;
  return typeof issuedAt === 'number' ? issuedAt : null;
};

/** `sub` from the token payload; used to explain why Auth rejected a token. */
export const tokenSubject = (token: string): string | null => {
  const subject = decodePayload(token)?.sub;
  return typeof subject === 'string' ? subject : null;
};

export const readBearerToken = (header: string | undefined): string | null => {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
};

/**
 * Verifies an access token by asking Supabase Auth (`/auth/v1/user`), which checks
 * the signature, issuer and `exp`. Missing, expired or invalid tokens yield null.
 */
export const getAuthUser = async (token: string): Promise<AuthUser | null> => {
  const base = env.supabaseUrl();
  if (!base) return null;

  const response = await fetch(`${base}/auth/v1/user`, {
    headers: { apikey: env.supabaseServiceKey(), authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;

  const user = (await response.json()) as {
    id?: string;
    email?: string;
    user_metadata?: {
      locale?: string;
      name?: string;
      termsAcceptedAt?: string;
      termsVersion?: string;
      privacyVersion?: string;
    } | null;
    app_metadata?: { providers?: string[] } | null;
  };
  if (!user.id || !user.email) return null;

  const metadata = user.user_metadata ?? {};
  const acceptedAt = typeof metadata.termsAcceptedAt === 'string' ? new Date(metadata.termsAcceptedAt) : null;
  return {
    id: user.id,
    email: user.email.toLowerCase(),
    locale: parseLanguage(metadata.locale),
    name: (metadata.name ?? '').trim() || user.email.split('@')[0] || 'Uspomena',
    termsAcceptedAt: acceptedAt && !Number.isNaN(acceptedAt.getTime()) ? acceptedAt : null,
    termsVersion: typeof metadata.termsVersion === 'string' ? metadata.termsVersion : null,
    privacyVersion: typeof metadata.privacyVersion === 'string' ? metadata.privacyVersion : null,
    providers: user.app_metadata?.providers ?? [],
  };
};
