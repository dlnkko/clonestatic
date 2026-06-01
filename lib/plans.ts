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
  badge?: PlanBadge;
  checkoutMonthly: string;
  checkoutYearly: string;
};

export const FREE_TRIAL_MAX_PRODUCTS = 1;

export const PAID_PLANS: PlanLimits[] = [
  {
    key: 'standard',
    name: 'Starter',
    tagline: 'Explore and validate',
    credits: 40,
    maxProducts: 3,
    monthlyPriceUsd: 29,
    checkoutMonthly: 'standard_monthly',
    checkoutYearly: 'standard_yearly',
  },
  {
    key: 'pro',
    name: 'Pro',
    tagline: 'For active creators',
    credits: 120,
    maxProducts: 10,
    monthlyPriceUsd: 79,
    badge: 'popular',
    checkoutMonthly: 'pro_monthly',
    checkoutYearly: 'pro_yearly',
  },
  {
    key: 'scale',
    name: 'Studio',
    tagline: 'For teams and brands',
    credits: 300,
    maxProducts: 25,
    monthlyPriceUsd: 179,
    badge: 'best_value',
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
  plan_1qy7pizl7xAkx: 'standard',
  plan_KRjrbQ6Z0D2A5: 'standard',
  plan_xb9A75BEfcTGk: 'pro',
  plan_CNk2XegENVQGM: 'pro',
};

export function registerWhopPlanId(planId: string, key: PaidPlanKey) {
  WHOP_PLAN_ID_MAP[planId] = key;
}

/** Load optional Studio (scale) plan IDs from env at runtime (server). */
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
    features.push('3 team seats');
  }
  return features;
}

/** @deprecated Use planFeatureList */
export const PLAN_FEATURES = planFeatureList;

export const FREE_PLAN_FEATURES = [
  '1 free generation',
  '1 saved product',
  'Ad library',
  'History',
  'All aspect ratios',
];
