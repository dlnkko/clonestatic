import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOwnerEmail } from '@/lib/subscription-limits';
import { maxProductsForPlan, planDisplayName, isEntitledPlan, isPaidPlan } from '@/lib/plans';
import { syncWhopSubscriptionForEmailWithRetries } from '@/lib/whop';
import {
  clearPendingWhopCheckoutCookie,
  hasPendingWhopCheckout,
} from '@/lib/pending-checkout';

export const dynamic = 'force-dynamic';

async function loadSubscriptionRow(admin: ReturnType<typeof createAdminClient>, email: string) {
  return admin
    .from('subscriptions')
    .select('plan, credits_remaining, period_end, cancel_at_period_end, whop_membership_id')
    .eq('email', email)
    .maybeSingle();
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.email) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const email = user.email.trim().toLowerCase();
  if (!email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Valid email required' }, { status: 400 });
  }

  const isOwner = email === resolveOwnerEmail();
  if (isOwner) {
    const admin = createAdminClient();
    const { count: productCount } = await admin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    const count = productCount ?? 0;
    const maxProducts = maxProductsForPlan('owner');
    return NextResponse.json({
      ok: true,
      plan: 'owner',
      credits_remaining: 999999,
      max_products: maxProducts,
      product_count: count,
      can_add_product: true,
      period_end: null,
      cancel_at_period_end: false,
      plan_name: 'Owner',
    });
  }

  try {
    const admin = createAdminClient();
    const pendingCheckout = hasPendingWhopCheckout(request);

    let { data, error } = await loadSubscriptionRow(admin, email);

    if (error || !data || !isEntitledPlan(data.plan)) {
      const syncAttempts = pendingCheckout ? 3 : 1;
      const syncResult = await syncWhopSubscriptionForEmailWithRetries(email, {
        maxAttempts: syncAttempts,
        delayMs: 1500,
      });

      if (syncResult.ok) {
        const refreshed = await loadSubscriptionRow(admin, email);
        if (refreshed.data && isEntitledPlan(refreshed.data.plan)) {
          data = refreshed.data;
          error = refreshed.error;
        }
      } else if (syncResult.error !== 'WHOP_API_KEY not configured') {
        console.warn('GET /api/subscription Whop sync:', syncResult.error, 'email=', email);
      }
    }

    const { count: productCount } = await admin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const count = productCount ?? 0;

    if (error || !data || !isEntitledPlan(data.plan)) {
      if (pendingCheckout) {
        const response = NextResponse.json(
          {
            ok: false,
            error: 'Activating subscription',
            pending_checkout: true,
          },
          { status: 428 }
        );
        return response;
      }

      return NextResponse.json({ ok: false, error: 'No subscription found' }, { status: 404 });
    }

    const credits = Math.max(0, data.credits_remaining ?? 0);
    const maxProducts = maxProductsForPlan(data.plan);

    const response = NextResponse.json({
      ok: true,
      plan: data.plan,
      plan_name: planDisplayName(data.plan),
      credits_remaining: credits,
      max_products: maxProducts,
      product_count: count,
      can_add_product: count < maxProducts,
      period_end: data.period_end,
      cancel_at_period_end: data.cancel_at_period_end === true,
      has_whop_membership: Boolean(data.whop_membership_id),
      is_one_time: !isPaidPlan(data.plan),
    });
    clearPendingWhopCheckoutCookie(response);
    return response;
  } catch (err) {
    console.error('GET /api/subscription:', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
