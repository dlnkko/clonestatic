import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const AUTH_NEXT = 'auth_next';
const AUTH_PLAN = 'auth_plan';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  let next = searchParams.get('next') ?? '';
  let plan = searchParams.get('plan') ?? '';

  const cookieStore = await cookies();
  if (!next && cookieStore.get(AUTH_NEXT)?.value) {
    next = decodeURIComponent(cookieStore.get(AUTH_NEXT)!.value);
  }
  if (!plan && cookieStore.get(AUTH_PLAN)?.value) {
    plan = decodeURIComponent(cookieStore.get(AUTH_PLAN)!.value);
  }
  if (!next) next = '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Auth callback exchange error:', error);
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }
  }

  const origin = request.nextUrl.origin;
  const redirectUrl =
    next === 'checkout' && plan
      ? new URL(`/checkout-redirect?plan=${encodeURIComponent(plan)}`, origin)
      : next.startsWith('/')
        ? new URL(next, origin)
        : new URL('/', origin);

  const res = NextResponse.redirect(redirectUrl);
  res.cookies.set(AUTH_NEXT, '', { path: '/', maxAge: 0 });
  res.cookies.set(AUTH_PLAN, '', { path: '/', maxAge: 0 });
  return res;
}
