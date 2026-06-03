import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

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

export async function middleware(request: NextRequest) {
  const oauthRedirect = redirectOAuthCodeToCallback(request);
  if (oauthRedirect) return oauthRedirect;

  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
