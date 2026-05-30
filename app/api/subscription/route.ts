import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getClientIpHash, getFreeTrialRemaining } from '@/lib/free-trial';
import { getUserSubscriptionContext, resolveOwnerEmail } from '@/lib/subscription-limits';
import { maxProductsForPlan, PAID_PLAN_BY_KEY, isPaidPlan } from '@/lib/plans';

export const dynamic = 'force-dynamic';

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
    const ctx = await getUserSubscriptionContext(admin, user.id, email);
    return NextResponse.json({
      ok: true,
      plan: 'owner',
      credits_remaining: 999999,
      max_products: ctx.maxProducts,
      product_count: ctx.productCount,
      can_add_product: ctx.canAddProduct,
      period_end: null,
      cancel_at_period_end: false,
      plan_name: 'Owner',
    });
  }

  try {
    const admin = createAdminClient();
    const ipHash = getClientIpHash(request);

    const { data, error } = await admin
      .from('subscriptions')
      .select('plan, credits_remaining, period_end, cancel_at_period_end, whop_membership_id')
      .eq('email', email)
      .maybeSingle();

    const { count: productCount } = await admin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const count = productCount ?? 0;

    if (error || !data || !isPaidPlan(data.plan)) {
      const freeTrialRemaining = await getFreeTrialRemaining(admin, ipHash);
      if (freeTrialRemaining > 0) {
        const maxProducts = maxProductsForPlan('free_trial');
        return NextResponse.json({
          ok: true,
          plan: 'free_trial',
          credits_remaining: freeTrialRemaining,
          max_products: maxProducts,
          product_count: count,
          can_add_product: count < maxProducts,
          period_end: null,
          cancel_at_period_end: false,
          plan_name: 'Free trial',
        });
      }

      return NextResponse.json({ ok: false, error: 'No subscription found' }, { status: 404 });
    }

    const credits = Math.max(0, data.credits_remaining ?? 0);
    const maxProducts = maxProductsForPlan(data.plan);
    const planMeta = PAID_PLAN_BY_KEY[data.plan];

    return NextResponse.json({
      ok: true,
      plan: data.plan,
      plan_name: planMeta?.name ?? data.plan,
      credits_remaining: credits,
      max_products: maxProducts,
      product_count: count,
      can_add_product: count < maxProducts,
      period_end: data.period_end,
      cancel_at_period_end: data.cancel_at_period_end === true,
      has_whop_membership: Boolean(data.whop_membership_id),
    });
  } catch (err) {
    console.error('GET /api/subscription:', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
