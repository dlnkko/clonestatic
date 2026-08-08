/** Recurring subscription keys stored in Supabase `subscriptions.plan`. */
export type PaidPlanKey = 'standard' | 'pro' | 'scale';

/** One-time purchase keys (Whop single payment, no renewal). */
export type OneTimePlanKey =
  | 'pack_20'
  | 'pack_30'
  | 'pack_50'
  | 'pack_70'
  | 'pack_120'
  | 'pack_150'
  | 'pack_200'
  | 'pack_300'
  | 'pack_400'
  | 'pack_500'
  /** @deprecated Legacy key; same entitlement as pack_20 */
  | 'pack_10';

export type BillingPlanKey = PaidPlanKey | OneTimePlanKey;

export type SubscriptionPlan = BillingPlanKey | 'free_trial' | 'owner';

export type PlanBadge = 'popular' | 'best_value';

export type PlanLimits = {
  key: PaidPlanKey;
  name: string;
  tagline: string;
  credits: number;
  maxProducts: number;
  /** Max team member invites (seats) for this subscription. */
  maxTeamSeats: number;
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

const ONE_TIME_MAX_PRODUCTS = FREE_TRIAL_MAX_PRODUCTS;
/** One-time packs are credit top-ups only; seats come from monthly plans. */
export const ONE_TIME_MAX_TEAM_SEATS = 0;

/** All purchasable one-time credit packs (landing slider + Whop). */
export const ONE_TIME_PACKS: OneTimePlanLimits[] = [
  {
    key: 'pack_20',
    name: '20 Ads Pack',
    tagline: 'Pay once, mirror 20 static ads',
    credits: 20,
    maxProducts: ONE_TIME_MAX_PRODUCTS,
    priceUsd: 19.99,
    checkoutKey: 'pack_20',
    whopPlanId: 'plan_mSx19dfVltKNW',
  },
  {
    key: 'pack_30',
    name: '30 Ads Pack',
    tagline: 'Pay once, mirror 30 static ads',
    credits: 30,
    maxProducts: ONE_TIME_MAX_PRODUCTS,
    priceUsd: 27.99,
    checkoutKey: 'pack_30',
    whopPlanId: 'plan_sTHkmsUgoluii',
  },
  {
    key: 'pack_50',
    name: '50 Ads Pack',
    tagline: 'Pay once, mirror 50 static ads',
    credits: 50,
    maxProducts: ONE_TIME_MAX_PRODUCTS,
    priceUsd: 44.99,
    checkoutKey: 'pack_50',
    whopPlanId: 'plan_zXdo0TUmCMyOJ',
  },
  {
    key: 'pack_70',
    name: '70 Ads Pack',
    tagline: 'Pay once, mirror 70 static ads',
    credits: 70,
    maxProducts: ONE_TIME_MAX_PRODUCTS,
    priceUsd: 59.99,
    checkoutKey: 'pack_70',
    whopPlanId: 'plan_O5mZ5qt9x5wFR',
  },
  {
    key: 'pack_120',
    name: '120 Ads Pack',
    tagline: 'Pay once, mirror 120 static ads',
    credits: 120,
    maxProducts: ONE_TIME_MAX_PRODUCTS,
    priceUsd: 95.99,
    checkoutKey: 'pack_120',
    whopPlanId: 'plan_M5PoCa6aDcn92',
  },
  {
    key: 'pack_150',
    name: '150 Ads Pack',
    tagline: 'Pay once, mirror 150 static ads',
    credits: 150,
    maxProducts: ONE_TIME_MAX_PRODUCTS,
    priceUsd: 114.99,
    checkoutKey: 'pack_150',
    whopPlanId: 'plan_XJuVQAW7pWRNG',
  },
  {
    key: 'pack_200',
    name: '200 Ads Pack',
    tagline: 'Pay once, mirror 200 static ads',
    credits: 200,
    maxProducts: ONE_TIME_MAX_PRODUCTS,
    priceUsd: 147.99,
    checkoutKey: 'pack_200',
    whopPlanId: 'plan_zyKt0nmmJ3u5e',
  },
  {
    key: 'pack_300',
    name: '300 Ads Pack',
    tagline: 'Pay once, mirror 300 static ads',
    credits: 300,
    maxProducts: ONE_TIME_MAX_PRODUCTS,
    priceUsd: 209.99,
    checkoutKey: 'pack_300',
    whopPlanId: 'plan_VEYdxIdmkmxGx',
  },
  {
    key: 'pack_400',
    name: '400 Ads Pack',
    tagline: 'Pay once, mirror 400 static ads',
    credits: 400,
    maxProducts: ONE_TIME_MAX_PRODUCTS,
    priceUsd: 259.99,
    checkoutKey: 'pack_400',
    whopPlanId: 'plan_J0mfsxhuIDZIC',
  },
  {
    key: 'pack_500',
    name: '500 Ads Pack',
    tagline: 'Pay once, mirror 500 static ads',
    credits: 500,
    maxProducts: ONE_TIME_MAX_PRODUCTS,
    priceUsd: 319.99,
    checkoutKey: 'pack_500',
    whopPlanId: 'plan_Af5yFMOb76Lg8',
  },
];

export const ONE_TIME_PACK_BY_KEY = Object.fromEntries(
  ONE_TIME_PACKS.map((p) => [p.key, p])
) as Record<OneTimePlanKey, OneTimePlanLimits>;

// Legacy DB / checkout key → same as 20-credit pack
ONE_TIME_PACK_BY_KEY.pack_10 = ONE_TIME_PACK_BY_KEY.pack_20;

/** Default / smallest one-time pack (dashboard pricing card). */
export const ONE_TIME_PACK: OneTimePlanLimits = ONE_TIME_PACK_BY_KEY.pack_20;

/** Landing one-time credit slider options. */
export type CreditPackOption = {
  credits: number;
  priceUsd: number;
  checkoutKey: OneTimePlanKey;
};

export const CREDIT_PACK_OPTIONS: CreditPackOption[] = ONE_TIME_PACKS.map((p) => ({
  credits: p.credits,
  priceUsd: p.priceUsd,
  checkoutKey: p.key,
}));

export const PAID_PLANS: PlanLimits[] = [
  {
    key: 'standard',
    name: 'Starter',
    tagline: 'Explore and validate your first AI ads',
    credits: 40,
    maxProducts: 10,
    maxTeamSeats: 2,
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
    maxTeamSeats: 5,
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
    maxTeamSeats: 10,
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
  // One-time packs (current)
  plan_mSx19dfVltKNW: 'pack_20',
  plan_sTHkmsUgoluii: 'pack_30',
  plan_zXdo0TUmCMyOJ: 'pack_50',
  plan_O5mZ5qt9x5wFR: 'pack_70',
  plan_M5PoCa6aDcn92: 'pack_120',
  plan_XJuVQAW7pWRNG: 'pack_150',
  plan_zyKt0nmmJ3u5e: 'pack_200',
  plan_VEYdxIdmkmxGx: 'pack_300',
  plan_J0mfsxhuIDZIC: 'pack_400',
  plan_Af5yFMOb76Lg8: 'pack_500',
  // Legacy one-time pack
  plan_J9fyEIeUSVd8d: 'pack_20',
  // Subscriptions
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
  pack_20: 0,
  pack_30: 0,
  pack_50: 0,
  pack_70: 0,
  pack_120: 0,
  pack_150: 0,
  pack_200: 0,
  pack_300: 0,
  pack_400: 0,
  pack_500: 0,
  standard: 1,
  pro: 2,
  scale: 3,
};

export function paidPlanRank(plan: BillingPlanKey): number {
  return PLAN_RANK[plan] ?? 0;
}

export const WHOP_CHECKOUT_URLS: Record<string, string> = {
  pack_20: 'https://whop.com/checkout/plan_mSx19dfVltKNW',
  /** @deprecated use pack_20 */
  pack_10: 'https://whop.com/checkout/plan_mSx19dfVltKNW',
  pack_30: 'https://whop.com/checkout/plan_sTHkmsUgoluii',
  pack_50: 'https://whop.com/checkout/plan_zXdo0TUmCMyOJ',
  pack_70: 'https://whop.com/checkout/plan_O5mZ5qt9x5wFR',
  pack_120: 'https://whop.com/checkout/plan_M5PoCa6aDcn92',
  pack_150: 'https://whop.com/checkout/plan_XJuVQAW7pWRNG',
  pack_200: 'https://whop.com/checkout/plan_zyKt0nmmJ3u5e',
  pack_300: 'https://whop.com/checkout/plan_VEYdxIdmkmxGx',
  pack_400: 'https://whop.com/checkout/plan_J0mfsxhuIDZIC',
  pack_500: 'https://whop.com/checkout/plan_Af5yFMOb76Lg8',
  standard_monthly: 'https://whop.com/checkout/plan_tNyLmHA6Ecbve',
  standard_yearly: 'https://whop.com/checkout/plan_o5L5Qt9SceSYe',
  pro_monthly: 'https://whop.com/checkout/plan_3kuJzf26hKZk4',
  pro_yearly: 'https://whop.com/checkout/plan_PPgQmxqA06tS1',
  scale_monthly: 'https://whop.com/checkout/plan_5MIJfbYUpkoBx',
  scale_yearly: 'https://whop.com/checkout/plan_gnK3r9F8Qx3pX',
};

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

const ONE_TIME_WHOP_PLAN_IDS = new Set(ONE_TIME_PACKS.map((p) => p.whopPlanId));
// Legacy pack id still counts as one-time.
ONE_TIME_WHOP_PLAN_IDS.add('plan_J9fyEIeUSVd8d');

export function isOneTimeWhopPlanId(planId: string | undefined): boolean {
  if (!planId) return false;
  if (ONE_TIME_WHOP_PLAN_IDS.has(planId)) return true;
  const fromEnv = process.env.NEXT_PUBLIC_WHOP_PLAN_PACK_10?.trim();
  return Boolean(fromEnv && planId === fromEnv);
}

export function resolveWhopPlanKey(planId: string | undefined): BillingPlanKey {
  if (!planId) return 'standard';
  if (WHOP_PLAN_ID_MAP[planId]) return WHOP_PLAN_ID_MAP[planId];

  const packEnv = process.env.NEXT_PUBLIC_WHOP_PLAN_PACK_10?.trim();
  if (packEnv && planId === packEnv) return 'pack_20';

  const scaleMonthly = process.env.NEXT_PUBLIC_WHOP_PLAN_SCALE_MONTHLY;
  const scaleYearly = process.env.NEXT_PUBLIC_WHOP_PLAN_SCALE_YEARLY;
  if (scaleMonthly && planId === scaleMonthly) return 'scale';
  if (scaleYearly && planId === scaleYearly) return 'scale';

  return 'standard';
}

export function creditsForPlan(plan: BillingPlanKey): number {
  if (isOneTimePlan(plan)) return ONE_TIME_PACK_BY_KEY[plan].credits;
  return PAID_PLAN_BY_KEY[plan]?.credits ?? PAID_PLAN_BY_KEY.standard.credits;
}

export function maxProductsForPlan(plan: SubscriptionPlan): number {
  if (plan === 'owner') return UNLIMITED_MAX_PRODUCTS;
  if (plan === 'free_trial') return FREE_TRIAL_MAX_PRODUCTS;
  if (isOneTimePlan(plan)) return ONE_TIME_PACK_BY_KEY[plan].maxProducts;
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
  return typeof plan === 'string' && plan in ONE_TIME_PACK_BY_KEY;
}

/** Active billing entitlement: recurring subscription or one-time pack purchase. */
export function isEntitledPlan(plan: string | null | undefined): plan is BillingPlanKey {
  return isPaidPlan(plan) || isOneTimePlan(plan);
}

export function planDisplayName(plan: SubscriptionPlan | string): string {
  if (plan === 'free_trial') return 'Free trial';
  if (plan === 'owner') return 'Owner';
  if (isOneTimePlan(plan)) return ONE_TIME_PACK_BY_KEY[plan].name;
  if (isPaidPlan(plan)) return PAID_PLAN_BY_KEY[plan].name;
  return String(plan);
}

export function oneTimePlanFeatureList(plan: OneTimePlanLimits = ONE_TIME_PACK): string[] {
  return [
    `${plan.credits} AI image generations`,
    'Credits stack on your account',
    'Ad library',
    'History',
    'One-time payment · no subscription',
  ];
}

export function planFeatureList(plan: PlanLimits): string[] {
  const productLabel = isUnlimitedProducts(plan.maxProducts)
    ? 'Unlimited products'
    : `${plan.maxProducts} saved products`;
  return [
    `${plan.credits} images/month`,
    productLabel,
    `${plan.maxTeamSeats} team seats`,
  ];
}

/** Team member invite cap for a billing plan (monthly or annual same). */
export function maxTeamSeatsForPlan(plan: string | null | undefined): number {
  if (plan === 'owner') return 50;
  if (isPaidPlan(plan)) return PAID_PLAN_BY_KEY[plan].maxTeamSeats;
  if (isOneTimePlan(plan)) return ONE_TIME_MAX_TEAM_SEATS;
  return 0;
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
