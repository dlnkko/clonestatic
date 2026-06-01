/** Paid plan keys stored in Supabase `subscriptions.plan`. */
export type PaidPlanKey = 'standard' | 'pro' | 'scale';

export type SubscriptionPlan = PaidPlanKey | 'free_trial' | 'owner';

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

export const FREE_TRIAL_MAX_PRODUCTS = 1;
export const FREE_TRIAL_CREDITS = 2;

export const PAID_PLANS: PlanLimits[] = [
  {
    key: 'standard',
    name: 'Starter',
    tagline: 'Explore and validate your first AI ads',
    credits: 40,
    maxProducts: 3,
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
    maxProducts: 8,
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
    maxProducts: 20,
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

/** Whop plan IDs → internal plan key (monthly + yearly per tier). */
export const WHOP_PLAN_ID_MAP: Record<string, PaidPlanKey> = {
  plan_tNyLmHA6Ecbve: 'standard',
  plan_o5L5Qt9SceSYe: 'standard',
  plan_3kuJzf26hKZk4: 'pro',
  plan_PPgQmxqA06tS1: 'pro',
  plan_5MIJfbYUpkoBx: 'scale',
  plan_gnK3r9F8Qx3pX: 'scale',
};

export const WHOP_CHECKOUT_URLS = {
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

export function registerWhopPlanId(planId: string, key: PaidPlanKey) {
  WHOP_PLAN_ID_MAP[planId] = key;
}

/** Load optional Pro tier (scale key) plan IDs from env at runtime (server). */
export function resolveWhopPlanKey(planId: string | undefined): PaidPlanKey {
  if (!planId) return 'standard';
  if (WHOP_PLAN_ID_MAP[planId]) return WHOP_PLAN_ID_MAP[planId];

  const scaleMonthly = process.env.NEXT_PUBLIC_WHOP_PLAN_SCALE_MONTHLY;
  const scaleYearly = process.env.NEXT_PUBLIC_WHOP_PLAN_SCALE_YEARLY;
  if (scaleMonthly && planId === scaleMonthly) return 'scale';
  if (scaleYearly && planId === scaleYearly) return 'scale';

  return 'standard';
}

export function creditsForPlan(plan: PaidPlanKey): number {
  return PAID_PLAN_BY_KEY[plan]?.credits ?? PAID_PLAN_BY_KEY.standard.credits;
}

export function maxProductsForPlan(plan: SubscriptionPlan): number {
  if (plan === 'owner') return 9999;
  if (plan === 'free_trial') return FREE_TRIAL_MAX_PRODUCTS;
  return PAID_PLAN_BY_KEY[plan as PaidPlanKey]?.maxProducts ?? FREE_TRIAL_MAX_PRODUCTS;
}

export function isPaidPlan(plan: string | null | undefined): plan is PaidPlanKey {
  return plan === 'standard' || plan === 'pro' || plan === 'scale';
}

export function planDisplayName(plan: SubscriptionPlan | string): string {
  if (plan === 'free_trial') return 'Free trial';
  if (plan === 'owner') return 'Owner';
  if (isPaidPlan(plan)) return PAID_PLAN_BY_KEY[plan].name;
  return String(plan);
}

export function planFeatureList(plan: PlanLimits): string[] {
  const features = [
    `${plan.credits} images / month`,
    `Up to ${plan.maxProducts} saved products`,
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
