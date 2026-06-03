import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { getAppOrigin, isAppHost } from '@/lib/supabase/auth-config';

/**
 * Supabase OAuth sometimes redirects to Site URL (/) with ?code= instead of /auth/callback.
 * Forward those requests so the session is exchanged and checkout flow continues.
 */
function redirectOAuthCodeToCallback(request: NextRequest): NextResponse | null {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname.startsWith('/auth/callback')) return null;

  const code = searchParams.get('code');
  if (!code) return null;

  const url = request.nextUrl.clone();
  url.pathname = '/auth/callback';

  if (!url.searchParams.get('next')) {
    const authNext = request.cookies.get('auth_next')?.value;
    if (authNext) url.searchParams.set('next', decodeURIComponent(authNext));
  }
  if (!url.searchParams.get('plan')) {
    const authPlan = request.cookies.get('auth_plan')?.value;
    if (authPlan) url.searchParams.set('plan', decodeURIComponent(authPlan));
  }

  return NextResponse.redirect(url);
}

/** One canonical host so PKCE cookies match the OAuth callback URL. */
function redirectToCanonicalHost(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === 'development') return null;

  const canonical = new URL(getAppOrigin());
  const host = (request.headers.get('x-forwarded-host') ?? request.nextUrl.host).toLowerCase();

  if (!isAppHost(host) || host.split(':')[0] === canonical.host) return null;

  const url = request.nextUrl.clone();
  url.protocol = canonical.protocol;
  url.host = canonical.host;
  return NextResponse.redirect(url, 308);
}

export async function middleware(request: NextRequest) {
  const canonicalRedirect = redirectToCanonicalHost(request);
  if (canonicalRedirect) return canonicalRedirect;

  const oauthRedirect = redirectOAuthCodeToCallback(request);
  if (oauthRedirect) return oauthRedirect;

  if (request.nextUrl.pathname.startsWith('/auth/callback')) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
