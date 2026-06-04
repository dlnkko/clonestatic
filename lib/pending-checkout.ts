import type { NextRequest, NextResponse } from 'next/server';

export const PENDING_WHOP_CHECKOUT_COOKIE = 'pending_whop_checkout';

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24; // 24h

export function hasPendingWhopCheckout(request: NextRequest): boolean {
  return request.cookies.get(PENDING_WHOP_CHECKOUT_COOKIE)?.value === '1';
}

export function setPendingWhopCheckoutCookie(response: NextResponse): void {
  response.cookies.set(PENDING_WHOP_CHECKOUT_COOKIE, '1', {
    path: '/',
    maxAge: COOKIE_MAX_AGE_SEC,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function clearPendingWhopCheckoutCookie(response: NextResponse): void {
  response.cookies.set(PENDING_WHOP_CHECKOUT_COOKIE, '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}
