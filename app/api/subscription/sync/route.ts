import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  activateWhopSubscriptionFromPaymentId,
  syncWhopSubscriptionForEmail,
} from '@/lib/whop';
import { clearPendingWhopCheckoutCookie } from '@/lib/pending-checkout';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function readPaymentId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const paymentId = (body as Record<string, unknown>).payment_id;
  return typeof paymentId === 'string' && paymentId.startsWith('pay_') ? paymentId : null;
}

/** Fallback: activate subscription from Whop API when webhook is slow or failed. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.email) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const email = user.email.trim().toLowerCase();

  let paymentId: string | null = null;
  try {
    const body = await request.json();
    paymentId = readPaymentId(body);
  } catch {
    /* no body — email-only sync */
  }

  const result = paymentId
    ? await activateWhopSubscriptionFromPaymentId(paymentId, email)
    : await syncWhopSubscriptionForEmail(email);

  if (!result.ok) {
    console.error('POST /api/subscription/sync:', result.error, 'email=', email, 'payment=', paymentId);
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  const response = NextResponse.json({
    ok: true,
    plan: result.plan,
    credits_remaining: result.credits,
  });
  clearPendingWhopCheckoutCookie(response);
  return response;
}
