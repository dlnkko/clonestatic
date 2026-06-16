import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getUserSubscriptionContext,
  resolveOwnerEmail,
} from '@/lib/subscription-limits';
import { planDisplayName, isEntitledPlan, isPaidPlan } from '@/lib/plans';
import { syncWhopSubscriptionForEmailWithRetries } from '@/lib/whop';
import {
  clearPendingWhopCheckoutCookie,
  hasPendingWhopCheckout,
} from '@/lib/pending-checkout';
import { resolveBillingEmail } from '@/lib/team-members';

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
    const { count: productCount } = await admin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    const count = productCount ?? 0;
    const maxProducts = (await import('@/lib/plans')).maxProductsForPlan('owner');
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
      is_team_member: false,
      team_owner_email: null,
      can_manage_team: true,
    });
  }

  try {
    const admin = createAdminClient();
    const pendingCheckout = hasPendingWhopCheckout(request);
    const billing = await resolveBillingEmail(admin, email);

    let ctx = await getUserSubscriptionContext(admin, user.id, email);

    if (!isEntitledPlan(ctx.plan)) {
      if (!billing.isTeamMember) {
        const syncAttempts = pendingCheckout ? 3 : 1;
        const syncResult = await syncWhopSubscriptionForEmailWithRetries(email, {
          maxAttempts: syncAttempts,
          delayMs: 1500,
        });
        if (syncResult.ok) {
          ctx = await getUserSubscriptionContext(admin, user.id, email);
        } else if (syncResult.error !== 'WHOP_API_KEY not configured') {
          console.warn('GET /api/subscription Whop sync:', syncResult.error, 'email=', email);
        }
      }
    }

    if (!isEntitledPlan(ctx.plan)) {
      if (pendingCheckout && !billing.isTeamMember) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Activating subscription',
            pending_checkout: true,
          },
          { status: 428 }
        );
      }
      return NextResponse.json({ ok: false, error: 'No subscription found' }, { status: 404 });
    }

    const response = NextResponse.json({
      ok: true,
      plan: ctx.plan,
      plan_name: planDisplayName(ctx.plan),
      credits_remaining: ctx.creditsRemaining,
      max_products: ctx.maxProducts,
      product_count: ctx.productCount,
      can_add_product: ctx.canAddProduct,
      period_end: ctx.periodEnd,
      cancel_at_period_end: ctx.cancelAtPeriodEnd,
      has_whop_membership: Boolean(ctx.whopMembershipId),
      is_one_time: !isPaidPlan(ctx.plan),
      is_team_member: ctx.isTeamMember,
      team_owner_email: ctx.teamOwnerEmail,
      can_manage_team: ctx.canManageTeam,
    });
    if (!billing.isTeamMember) {
      clearPendingWhopCheckoutCookie(response);
    }
    return response;
  } catch (err) {
    console.error('GET /api/subscription:', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
