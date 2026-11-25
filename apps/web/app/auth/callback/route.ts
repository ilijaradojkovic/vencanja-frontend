import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { getServerAuth } from '@/lib/auth/server';

/** Only same-site organizer paths are accepted as `next` (no open redirects). */
const safeNext = (value: string | null): string | null => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value.startsWith('/app') || value === '/onboarding' ? value : null;
};

/**
 * `/auth/callback` — the single callback for both email-link types produced by the
 * Send Email Hook (`token_hash` + `type`, verified with `verifyOtp`) and the Google
 * PKCE flow (`code`, exchanged for a session). Errors go back to `/login` with a
 * localized "link expired" message.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const type = searchParams.get('type');
  const tokenHash = searchParams.get('token_hash');
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  const failure = NextResponse.redirect(new URL('/login?error=linkExpired', origin));
  if (searchParams.get('error')) return failure;

  const supabase = await getServerAuth();
  if (!supabase) return failure;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failure;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (error) return failure;
  } else {
    return failure;
  }

  const target = type === 'recovery' ? '/nova-lozinka' : type === 'email_change' ? '/app' : (next ?? '/onboarding');
  return NextResponse.redirect(new URL(target, origin));
}
