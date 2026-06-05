import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isEntitledPlan,
  maxProductsForPlan,
  planDisplayName,
  type SubscriptionPlan,
} from '@/lib/plans';

const DEFAULT_OWNER_EMAIL = 'diegolinaresd10@gmail.com';

export function resolveOwnerEmail(): string {
  const fromEnv = process.env.OWNER_EMAIL?.trim()?.toLowerCase();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_OWNER_EMAIL;
}

export type UserSubscriptionContext = {
  plan: SubscriptionPlan;
  creditsRemaining: number;
  maxProducts: number;
  productCount: number;
  canAddProduct: boolean;
  whopMembershipId: string | null;
  cancelAtPeriodEnd: boolean;
  periodEnd: string | null;
};

export async function getUserSubscriptionContext(
  admin: SupabaseClient,
  userId: string,
  email: string
): Promise<UserSubscriptionContext> {
  const normalizedEmail = email.trim().toLowerCase();
  const isOwner = normalizedEmail === resolveOwnerEmail();

  const { count: productCountRaw } = await admin
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const productCount = productCountRaw ?? 0;

  if (isOwner) {
    return {
      plan: 'owner',
      creditsRemaining: 999999,
      maxProducts: maxProductsForPlan('owner'),
      productCount,
      canAddProduct: true,
      whopMembershipId: null,
      cancelAtPeriodEnd: false,
      periodEnd: null,
    };
  }

  const { data: sub } = await admin
    .from('subscriptions')
    .select('plan, credits_remaining, period_end, whop_membership_id, cancel_at_period_end')
    .eq('email', normalizedEmail)
    .maybeSingle();

  let activeSub = sub;

  if (!activeSub || !isEntitledPlan(activeSub.plan)) {
    const { syncWhopSubscriptionForEmailWithRetries } = await import('@/lib/whop');
    const syncResult = await syncWhopSubscriptionForEmailWithRetries(normalizedEmail, {
      maxAttempts: 3,
      delayMs: 1500,
    });
    if (syncResult.ok) {
      const refreshed = await admin
        .from('subscriptions')
        .select('plan, credits_remaining, period_end, whop_membership_id, cancel_at_period_end')
        .eq('email', normalizedEmail)
        .maybeSingle();
      if (refreshed.data && isEntitledPlan(refreshed.data.plan)) {
        activeSub = refreshed.data;
      }
    }
  }

  if (activeSub && isEntitledPlan(activeSub.plan)) {
    const maxProducts = maxProductsForPlan(activeSub.plan);
    return {
      plan: activeSub.plan,
      creditsRemaining: Math.max(0, activeSub.credits_remaining ?? 0),
      maxProducts,
      productCount,
      canAddProduct: productCount < maxProducts,
      whopMembershipId: activeSub.whop_membership_id ?? null,
      cancelAtPeriodEnd: activeSub.cancel_at_period_end === true,
      periodEnd: activeSub.period_end ?? null,
    };
  }

  return {
    plan: 'free_trial',
    creditsRemaining: 0,
    maxProducts: 0,
    productCount,
    canAddProduct: false,
    whopMembershipId: null,
    cancelAtPeriodEnd: false,
    periodEnd: null,
  };
}

export async function assertCanAddProduct(
  admin: SupabaseClient,
  userId: string,
  email: string
): Promise<{ ok: true } | { ok: false; message: string; maxProducts: number; productCount: number }> {
  const ctx = await getUserSubscriptionContext(admin, userId, email);
  if (ctx.canAddProduct) return { ok: true };

  const planLabel = planDisplayName(ctx.plan);

  return {
    ok: false,
    message: `Product limit reached (${ctx.productCount}/${ctx.maxProducts}). Upgrade your ${planLabel} plan to add more products.`,
    maxProducts: ctx.maxProducts,
    productCount: ctx.productCount,
  };
}
