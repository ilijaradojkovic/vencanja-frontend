import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { isAuthConfigured, supabaseKey, supabaseUrl } from '@/lib/auth/config';

/**
 * Guest and public pages must never land in a shared cache (SPEC §3.3), and a
 * nonce-based CSP will also require dynamic rendering.
 */
const GUEST_PATH = /^\/(i|w)(\/|$)/;
/** Signed-out visitors are sent to the login page; this is UX, not authorization. */
const PROTECTED_PATH = /^\/(app|admin|onboarding)(\/|$)/;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  if (isAuthConfigured()) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && PROTECTED_PATH.test(pathname)) {
      const login = request.nextUrl.clone();
      login.pathname = '/login';
      login.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(login);
    }
  }

  if (GUEST_PATH.test(pathname)) response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/i/:path*', '/w/:path*', '/app/:path*', '/admin/:path*', '/onboarding'],
};
