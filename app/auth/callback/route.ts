import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getSupabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Missing Supabase anon key');
  return key;
}

function resolveRedirectPath(next: string, plan: string): string {
  if (next === 'checkout' && plan) {
    return `/checkout-redirect?plan=${encodeURIComponent(plan)}`;
  }
  if (next.startsWith('/')) return next;
  return '/app';
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const origin = request.nextUrl.origin;

  let next = searchParams.get('next') ?? '';
  let plan = searchParams.get('plan') ?? '';

  const cookieStore = await cookies();
  if (!next) {
    const fromCookie = cookieStore.get('auth_next')?.value;
    if (fromCookie) next = decodeURIComponent(fromCookie);
  }
  if (!plan) {
    const fromCookie = cookieStore.get('auth_plan')?.value;
    if (fromCookie) plan = decodeURIComponent(fromCookie);
  }
  if (!next || next === '/') next = '/app';

  const redirectPath = resolveRedirectPath(next, plan);
  const redirectUrl = new URL(redirectPath, origin);

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin));
  }

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
    console.error('Auth callback exchange error:', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin));
  }

  response.cookies.set('auth_next', '', { path: '/', maxAge: 0 });
  response.cookies.set('auth_plan', '', { path: '/', maxAge: 0 });

  return response;
}
