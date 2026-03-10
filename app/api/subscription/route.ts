import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getClientIpHash, hasUsedFreeTrial } from '@/lib/free-trial';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.email) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const email = user.email.trim().toLowerCase();
  if (!email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Valid email required' }, { status: 400 });
  }

  const ownerEmailFromEnv = process.env.OWNER_EMAIL?.trim()?.toLowerCase();
  const ownerEmail =
    ownerEmailFromEnv && ownerEmailFromEnv.length > 0
      ? ownerEmailFromEnv
      : 'diegolinaresd10@gmail.com';
  const isOwner = email === ownerEmail;
  if (isOwner) {
    return NextResponse.json({
      ok: true,
      plan: 'owner',
      credits_remaining: 999999,
      period_end: null,
    });
  }

  try {
    const admin = createAdminClient();
    const ipHash = getClientIpHash(request);

    const { data, error } = await admin
      .from('subscriptions')
      .select('plan, credits_remaining, period_end')
      .eq('email', email)
      .single();

    if (error || !data) {
      // No paid subscription. Check if this IP still has a free trial available.
      const usedFreeTrial = await hasUsedFreeTrial(admin, ipHash);
      if (!usedFreeTrial) {
        // Expose 1 "virtual" credit from free trial so the UI shows 1 and allows one generation.
        return NextResponse.json({
          ok: true,
          plan: 'free_trial',
          credits_remaining: 1,
          period_end: null,
        });
      }

      return NextResponse.json({ ok: false, error: 'No subscription found' }, { status: 404 });
    }

    const credits = Math.max(0, data.credits_remaining ?? 0);
    return NextResponse.json({
      ok: true,
      plan: data.plan,
      credits_remaining: credits,
      period_end: data.period_end,
    });
  } catch (err) {
    console.error('GET /api/subscription:', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
