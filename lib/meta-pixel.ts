import { ONE_TIME_PACK_BY_KEY, PAID_PLANS, isOneTimePlan } from '@/lib/plans';

export const META_PIXEL_ID = '1545793723950813';

const PURCHASE_SENT_KEY = 'admirror_meta_purchase_sent';
const META_VALUE_KEY = 'admirror_meta_purchase_value';
const META_PLAN_KEY = 'admirror_meta_purchase_plan';

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    __admirrorPurchaseSent?: boolean;
    __admirrorAddToCartSent?: string;
  }
}

/** USD amount for a Whop checkout plan key (e.g. pack_20, pro_monthly). */
export function metaCheckoutValueForPlan(plan: string | null | undefined): number | null {
  if (!plan) return null;
  const key = plan.trim().toLowerCase();
  if (isOneTimePlan(key)) {
    const pack = ONE_TIME_PACK_BY_KEY[key];
    return pack?.priceUsd ?? null;
  }
  for (const p of PAID_PLANS) {
    if (p.checkoutMonthly === key) return p.monthlyPriceUsd;
    if (p.checkoutYearly === key) return p.yearlyTotalUsd;
  }
  if (key === 'pack_10') return ONE_TIME_PACK_BY_KEY.pack_20.priceUsd;
  return null;
}

/**
 * Fire Meta AddToCart when the user is about to leave for Whop checkout.
 * Does not touch Purchase / post-purchase tracking.
 */
export function trackMetaAddToCart(plan: string): Promise<void> {
  return new Promise((resolve) => {
    const contentName = plan.trim() || 'unknown';
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    if (window.__admirrorAddToCartSent === contentName) {
      resolve();
      return;
    }

    const value = metaCheckoutValueForPlan(contentName);
    const payload: Record<string, string | number> = {
      currency: 'USD',
      content_name: contentName,
      content_type: 'product',
    };
    if (value != null && Number.isFinite(value)) {
      payload.value = value;
    }

    let fired = false;
    const fire = (): boolean => {
      try {
        if (typeof window.fbq !== 'function') return false;
        if (fired || window.__admirrorAddToCartSent === contentName) return true;
        window.fbq('track', 'AddToCart', payload);
        window.__admirrorAddToCartSent = contentName;
        fired = true;
        return true;
      } catch {
        return false;
      }
    };

    const done = () => {
      window.setTimeout(() => resolve(), fired ? 400 : 0);
    };

    if (fire()) {
      done();
      return;
    }

    let attempts = 0;
    const id = window.setInterval(() => {
      attempts += 1;
      if (fire() || attempts >= 12) {
        window.clearInterval(id);
        done();
      }
    }, 200);
  });
}

/** Persist value/plan from Whop success URL so /onboarding can still read them after redirect. */
export function stashMetaPurchaseParamsFromUrl(search?: string) {
  try {
    const params = new URLSearchParams(search ?? window.location.search);
    const value = params.get('value')?.trim();
    const plan = params.get('plan')?.trim();
    if (value) sessionStorage.setItem(META_VALUE_KEY, value);
    if (plan) sessionStorage.setItem(META_PLAN_KEY, plan);
  } catch {
    /* ignore */
  }
}

function readPurchaseParams(): { value: string | null; plan: string | null } {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('value')?.trim() || sessionStorage.getItem(META_VALUE_KEY);
    const plan = params.get('plan')?.trim() || sessionStorage.getItem(META_PLAN_KEY);
    return { value, plan };
  } catch {
    return { value: null, plan: null };
  }
}

function clearStashedPurchaseParams() {
  try {
    sessionStorage.removeItem(META_VALUE_KEY);
    sessionStorage.removeItem(META_PLAN_KEY);
  } catch {
    /* ignore */
  }
}

function alreadySentPurchase(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.__admirrorPurchaseSent) return true;
  try {
    return sessionStorage.getItem(PURCHASE_SENT_KEY) === '1';
  } catch {
    return false;
  }
}

function markPurchaseSent() {
  window.__admirrorPurchaseSent = true;
  try {
    sessionStorage.setItem(PURCHASE_SENT_KEY, '1');
  } catch {
    /* ignore */
  }
}

function firePurchase(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (alreadySentPurchase()) return true;
    if (typeof window.fbq !== 'function') return false;

    const { value, plan } = readPurchaseParams();
    const parsed = value != null ? parseFloat(value) : NaN;

    if (Number.isFinite(parsed)) {
      window.fbq('track', 'Purchase', {
        currency: 'USD',
        value: parsed,
        content_name: plan || 'unknown',
      });
    } else {
      window.fbq('track', 'Purchase', { currency: 'USD' });
    }

    markPurchaseSent();
    clearStashedPurchaseParams();
    return true;
  } catch {
    return false;
  }
}

/** Fire Meta Purchase; /post-purchase always fires, /onboarding is a fallback. */
export function trackMetaPurchaseOnce() {
  if (firePurchase()) return;

  let attempts = 0;
  const id = window.setInterval(() => {
    attempts += 1;
    if (firePurchase() || attempts >= 20) {
      window.clearInterval(id);
    }
  }, 250);
}

/** Append stashed/current value+plan onto the onboarding path for the redirect. */
export function onboardingPathWithPurchaseParams(basePath: string): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('value')?.trim() || sessionStorage.getItem(META_VALUE_KEY);
    const plan = params.get('plan')?.trim() || sessionStorage.getItem(META_PLAN_KEY);
    const next = new URL(basePath, window.location.origin);
    if (value) next.searchParams.set('value', value);
    if (plan) next.searchParams.set('plan', plan);
    return `${next.pathname}${next.search}`;
  } catch {
    return basePath;
  }
}
