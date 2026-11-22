import { NextResponse, type NextRequest } from 'next/server';

/**
 * Guest and public pages must never land in a shared cache (SPEC §3.3), and a
 * nonce-based CSP will also require dynamic rendering. Redirects and session
 * refresh are added in M2; this spike only fixes the caching contract.
 */
const GUEST_PATH = /^\/(i|w)(\/|$)/;

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (GUEST_PATH.test(request.nextUrl.pathname)) {
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
}

export const config = {
  matcher: ['/i/:path*', '/w/:path*'],
};
