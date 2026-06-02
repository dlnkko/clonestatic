import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncWhopSubscriptionForEmail } from '@/lib/whop';

export const dynamic = 'force-dynamic';

/** Fallback: activate subscription from Whop API when webhook is slow or failed. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.email) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const email = user.email.trim().toLowerCase();
  const result = await syncWhopSubscriptionForEmail(email);
  if (!result.ok) {
    console.error('POST /api/subscription/sync:', result.error, 'email=', email);
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    plan: result.plan,
    credits_remaining: result.credits,
  });
}
