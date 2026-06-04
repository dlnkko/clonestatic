import { NextResponse } from 'next/server';
import { setPendingWhopCheckoutCookie } from '@/lib/pending-checkout';

export const dynamic = 'force-dynamic';

/** Mark that the user is returning from Whop checkout (sets httpOnly cookie). */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  setPendingWhopCheckoutCookie(response);
  return response;
}
