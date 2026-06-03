import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { getAppOrigin, getSupabaseAnonKey } from '@/lib/supabase/auth-config';

export const dynamic = 'force-dynamic';

function resolveRedirectPath(next: string, plan: string): string {
  if (next === 'checkout' && plan) {
    return `/checkout-redirect?plan=${encodeURIComponent(plan)}`;
  }
  if (next.startsWith('/')) return next;
  return '/app';
}

function loginErrorRedirect(origin: string, reason: string): NextResponse {
  const url = new URL('/login', origin);
  url.searchParams.set('error', reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const oauthError = searchParams.get('error');
  const oauthErrorDescription = searchParams.get('error_description');

  const canonicalOrigin = getAppOrigin();
  const forwardedHost = request.headers.get('x-forwarded-host');
  const origin =
    process.env.NODE_ENV === 'development'
      ? request.nextUrl.origin
      : forwardedHost
        ? `${request.nextUrl.protocol}//${forwardedHost}`
        : canonicalOrigin;

  let next = searchParams.get('next') ?? '';
  let plan = searchParams.get('plan') ?? '';

  if (!next) {
    const fromCookie = request.cookies.get('auth_next')?.value;
    if (fromCookie) next = decodeURIComponent(fromCookie);
  }
  if (!plan) {
    const fromCookie = request.cookies.get('auth_plan')?.value;
    if (fromCookie) plan = decodeURIComponent(fromCookie);
  }
  if (!next || next === '/') next = '/app';

  if (oauthError) {
    console.error('Auth callback OAuth error:', oauthError, oauthErrorDescription);
    return loginErrorRedirect(origin, 'auth_failed');
  }

  if (!code) {
    console.error('Auth callback: missing code param');
    return loginErrorRedirect(origin, 'auth_failed');
  }

  const redirectPath = resolveRedirectPath(next, plan);
  const redirectUrl = new URL(redirectPath, canonicalOrigin);
  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('Auth callback exchange error:', error.message, error);
    return loginErrorRedirect(origin, 'auth_failed');
  }

  // supabase-js ≥2.91 defers SIGNED_IN; wait so SSR cookie adapter runs before response ends.
  await new Promise((resolve) => setTimeout(resolve, 0));

  response.cookies.set('auth_next', '', { path: '/', maxAge: 0 });
  response.cookies.set('auth_plan', '', { path: '/', maxAge: 0 });

  return response;
}
