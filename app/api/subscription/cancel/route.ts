import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelWhopMembership } from '@/lib/whop';
import { isPaidPlan } from '@/lib/plans';
import { resolveOwnerEmail } from '@/lib/subscription-limits';

export const dynamic = 'force-dynamic';

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
  if (email === resolveOwnerEmail()) {
    return NextResponse.json({ ok: false, error: 'Owner account cannot cancel via API' }, { status: 400 });
  }

  let body: { mode?: string; reason?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* default mode */
  }

  const mode = body.mode === 'immediate' ? 'immediate' : 'at_period_end';
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';
  if (reason.length < 5) {
    return NextResponse.json(
      { ok: false, error: 'Please tell us why you are cancelling (at least 5 characters).' },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const { data: sub, error } = await admin
      .from('subscriptions')
      .select('plan, whop_membership_id, cancel_at_period_end')
      .eq('email', email)
      .maybeSingle();

    if (error || !sub || !isPaidPlan(sub.plan)) {
      return NextResponse.json({ ok: false, error: 'No active paid subscription' }, { status: 404 });
    }

    if (sub.cancel_at_period_end) {
      return NextResponse.json({
        ok: true,
        already_cancelled: true,
        cancel_at_period_end: true,
        message: 'Cancellation already scheduled for end of billing period.',
      });
    }

    const membershipId = sub.whop_membership_id;
    if (!membershipId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Membership ID not found. Contact support or cancel from your Whop receipt email.',
        },
        { status: 422 }
      );
    }

    const result = await cancelWhopMembership(membershipId, mode);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }

    if (mode === 'immediate') {
      await admin.from('subscriptions').delete().eq('email', email);
    } else {
      await admin
        .from('subscriptions')
        .update({
          cancel_at_period_end: true,
          cancel_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email);
    }

    console.info('Subscription cancel requested:', { email, mode, reasonLength: reason.length });

    return NextResponse.json({
      ok: true,
      cancel_at_period_end: mode === 'at_period_end',
      immediate: mode === 'immediate',
      message:
        mode === 'immediate'
          ? 'Subscription cancelled. Access has ended.'
          : 'Subscription will cancel at the end of your billing period. You keep access until then.',
    });
  } catch (err) {
    console.error('POST /api/subscription/cancel:', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
