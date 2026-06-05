/** Recurring subscription keys stored in Supabase `subscriptions.plan`. */
export type PaidPlanKey = 'standard' | 'pro' | 'scale';

/** One-time purchase keys (Whop single payment, no renewal). */
export type OneTimePlanKey = 'pack_10';

export type BillingPlanKey = PaidPlanKey | OneTimePlanKey;

export type SubscriptionPlan = BillingPlanKey | 'free_trial' | 'owner';

export type PlanBadge = 'popular' | 'best_value';

export type PlanLimits = {
  key: PaidPlanKey;
  name: string;
  tagline: string;
  credits: number;
  maxProducts: number;
  /** Display price on landing (USD / month). Checkout amount is on Whop. */
  monthlyPriceUsd: number;
  /** Whop yearly charge (USD / year). */
  yearlyTotalUsd: number;
  /** Shown on Annual tab: effective monthly price when billed yearly. */
  annualMonthlyDisplayUsd: number;
  badge?: PlanBadge;
  checkoutMonthly: string;
  checkoutYearly: string;
};

export type OneTimePlanLimits = {
  key: OneTimePlanKey;
  name: string;
  tagline: string;
  credits: number;
  maxProducts: number;
  priceUsd: number;
  checkoutKey: string;
  whopPlanId: string;
};

export const FREE_TRIAL_MAX_PRODUCTS = 1;
export const FREE_TRIAL_CREDITS = 2;
/** Practical unlimited cap (same as owner). */
export const UNLIMITED_MAX_PRODUCTS = 9999;

export const ONE_TIME_PACK: OneTimePlanLimits = {
  key: 'pack_10',
  name: '10 Ads Pack',
  tagline: 'Pay once, mirror 10 static ads',
  credits: 10,
  maxProducts: 3,
  priceUsd: 9.99,
  checkoutKey: 'pack_10',
  whopPlanId: 'plan_J9fyEIeUSVd8d',
};

export const PAID_PLANS: PlanLimits[] = [
  {
    key: 'standard',
    name: 'Starter',
    tagline: 'Explore and validate your first AI ads',
    credits: 40,
    maxProducts: 10,
    monthlyPriceUsd: 29,
    yearlyTotalUsd: 279,
    annualMonthlyDisplayUsd: 23,
    checkoutMonthly: 'standard_monthly',
    checkoutYearly: 'standard_yearly',
  },
  {
    key: 'pro',
    name: 'Creator',
    tagline: 'For creators scaling content consistently',
    credits: 100,
    maxProducts: 25,
    monthlyPriceUsd: 59,
    yearlyTotalUsd: 569,
    annualMonthlyDisplayUsd: 47,
    checkoutMonthly: 'pro_monthly',
    checkoutYearly: 'pro_yearly',
  },
  {
    key: 'scale',
    name: 'Pro',
    tagline: 'For active brands producing ads at volume',
    credits: 200,
    maxProducts: UNLIMITED_MAX_PRODUCTS,
    monthlyPriceUsd: 99,
    yearlyTotalUsd: 950,
    annualMonthlyDisplayUsd: 79,
    badge: 'popular',
    checkoutMonthly: 'scale_monthly',
    checkoutYearly: 'scale_yearly',
  },
];

export const PAID_PLAN_BY_KEY = Object.fromEntries(
  PAID_PLANS.map((p) => [p.key, p])
) as Record<PaidPlanKey, PlanLimits>;

/** Agency tier — sales-led, not a Whop checkout key in-app. */
export const AGENCY_PLAN_DISPLAY = {
  name: 'Agency',
  tagline: 'For agencies and large teams',
  features: [
    'Custom image volume',
    'Unlimited products',
    'Unlimited seats',
    'Ad library',
    'History',
    'Priority support',
    'Custom billing',
  ],
} as const;

/** Whop plan IDs → internal plan key (monthly + yearly + one-time). */
export const WHOP_PLAN_ID_MAP: Record<string, BillingPlanKey> = {
  plan_J9fyEIeUSVd8d: 'pack_10',
  plan_tNyLmHA6Ecbve: 'standard',
  plan_o5L5Qt9SceSYe: 'standard',
  plan_3kuJzf26hKZk4: 'pro',
  plan_PPgQmxqA06tS1: 'pro',
  plan_5MIJfbYUpkoBx: 'scale',
  plan_gnK3r9F8Qx3pX: 'scale',
  // Legacy plans (previous Whop product)
  plan_1qy7pizl7xAkx: 'standard',
  plan_KRjrbQ6Z0D2A5: 'standard',
  plan_xb9A75BEfcTGk: 'pro',
  plan_CNk2XegENVQGM: 'pro',
};

const PLAN_RANK: Record<BillingPlanKey, number> = {
  pack_10: 0,
  standard: 1,
  pro: 2,
  scale: 3,
};

export function paidPlanRank(plan: BillingPlanKey): number {
  return PLAN_RANK[plan] ?? 0;
}

export const WHOP_CHECKOUT_URLS = {
  pack_10: 'https://whop.com/checkout/plan_J9fyEIeUSVd8d',
  standard_monthly: 'https://whop.com/checkout/plan_tNyLmHA6Ecbve',
  standard_yearly: 'https://whop.com/checkout/plan_o5L5Qt9SceSYe',
  pro_monthly: 'https://whop.com/checkout/plan_3kuJzf26hKZk4',
  pro_yearly: 'https://whop.com/checkout/plan_PPgQmxqA06tS1',
  scale_monthly: 'https://whop.com/checkout/plan_5MIJfbYUpkoBx',
  scale_yearly: 'https://whop.com/checkout/plan_gnK3r9F8Qx3pX',
} as const;

export type BillingPeriod = 'monthly' | 'yearly';

export function planDisplayPrice(plan: PlanLimits, billing: BillingPeriod): {
  amount: number;
  suffix: string;
  sublabel: string | null;
} {
  if (billing === 'monthly') {
    return { amount: plan.monthlyPriceUsd, suffix: '/mo', sublabel: null };
  }
  return {
    amount: plan.annualMonthlyDisplayUsd,
    suffix: '/mo',
    sublabel: 'billed annually',
  };
}

export function registerWhopPlanId(planId: string, key: BillingPlanKey) {
  WHOP_PLAN_ID_MAP[planId] = key;
}

/** Whop yearly plan IDs (annual billing). */
const WHOP_YEARLY_PLAN_IDS = new Set([
  'plan_o5L5Qt9SceSYe',
  'plan_PPgQmxqA06tS1',
  'plan_gnK3r9F8Qx3pX',
  'plan_KRjrbQ6Z0D2A5',
  'plan_CNk2XegENVQGM',
]);

export function isYearlyWhopPlanId(planId: string | undefined): boolean {
  if (!planId) return false;
  if (WHOP_YEARLY_PLAN_IDS.has(planId)) return true;
  const yearlyEnv = process.env.NEXT_PUBLIC_WHOP_PLAN_SCALE_YEARLY;
  return Boolean(yearlyEnv && planId === yearlyEnv);
}

export function isOneTimeWhopPlanId(planId: string | undefined): boolean {
  if (!planId) return false;
  if (planId === ONE_TIME_PACK.whopPlanId) return true;
  const fromEnv = process.env.NEXT_PUBLIC_WHOP_PLAN_PACK_10?.trim();
  return Boolean(fromEnv && planId === fromEnv);
}

export function resolveWhopPlanKey(planId: string | undefined): BillingPlanKey {
  if (!planId) return 'standard';
  if (WHOP_PLAN_ID_MAP[planId]) return WHOP_PLAN_ID_MAP[planId];

  const packEnv = process.env.NEXT_PUBLIC_WHOP_PLAN_PACK_10?.trim();
  if (packEnv && planId === packEnv) return 'pack_10';

  const scaleMonthly = process.env.NEXT_PUBLIC_WHOP_PLAN_SCALE_MONTHLY;
  const scaleYearly = process.env.NEXT_PUBLIC_WHOP_PLAN_SCALE_YEARLY;
  if (scaleMonthly && planId === scaleMonthly) return 'scale';
  if (scaleYearly && planId === scaleYearly) return 'scale';

  return 'standard';
}

export function creditsForPlan(plan: BillingPlanKey): number {
  if (plan === 'pack_10') return ONE_TIME_PACK.credits;
  return PAID_PLAN_BY_KEY[plan]?.credits ?? PAID_PLAN_BY_KEY.standard.credits;
}

export function maxProductsForPlan(plan: SubscriptionPlan): number {
  if (plan === 'owner') return UNLIMITED_MAX_PRODUCTS;
  if (plan === 'free_trial') return FREE_TRIAL_MAX_PRODUCTS;
  if (plan === 'pack_10') return ONE_TIME_PACK.maxProducts;
  return PAID_PLAN_BY_KEY[plan as PaidPlanKey]?.maxProducts ?? FREE_TRIAL_MAX_PRODUCTS;
}

export function isUnlimitedProducts(maxProducts: number): boolean {
  return maxProducts >= UNLIMITED_MAX_PRODUCTS;
}

export function formatMaxProductsLabel(maxProducts: number): string {
  return isUnlimitedProducts(maxProducts) ? 'Unlimited' : String(maxProducts);
}

export function isPaidPlan(plan: string | null | undefined): plan is PaidPlanKey {
  return plan === 'standard' || plan === 'pro' || plan === 'scale';
}

export function isOneTimePlan(plan: string | null | undefined): plan is OneTimePlanKey {
  return plan === 'pack_10';
}

/** Active billing entitlement: recurring subscription or one-time pack purchase. */
export function isEntitledPlan(plan: string | null | undefined): plan is BillingPlanKey {
  return isPaidPlan(plan) || isOneTimePlan(plan);
}

export function planDisplayName(plan: SubscriptionPlan | string): string {
  if (plan === 'free_trial') return 'Free trial';
  if (plan === 'owner') return 'Owner';
  if (isOneTimePlan(plan)) return ONE_TIME_PACK.name;
  if (isPaidPlan(plan)) return PAID_PLAN_BY_KEY[plan].name;
  return String(plan);
}

export function oneTimePlanFeatureList(plan: OneTimePlanLimits = ONE_TIME_PACK): string[] {
  return [
    `${plan.credits} AI image generations`,
    `${plan.maxProducts} saved products`,
    'Ad library',
    'History',
    'HD export',
    'One-time payment · no subscription',
  ];
}

export function planFeatureList(plan: PlanLimits): string[] {
  const productLabel = isUnlimitedProducts(plan.maxProducts)
    ? 'Unlimited saved products'
    : `Up to ${plan.maxProducts} saved products`;
  const features = [
    `${plan.credits} images / month`,
    productLabel,
    'Ad library',
    'History',
    'HD export',
  ];
  if (plan.key === 'scale') {
    features.push('Priority support');
  }
  return features;
}

/** @deprecated Use planFeatureList */
export const PLAN_FEATURES = planFeatureList;

export const FREE_PLAN_FEATURES = [
  `${FREE_TRIAL_CREDITS} free generations`,
  '1 saved product',
  'Ad library',
  'History',
  'All aspect ratios',
];
