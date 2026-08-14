export const META_PIXEL_ID = '1310852860892585';

const PURCHASE_TRACKED_KEY = 'admirror_meta_purchase_tracked';
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
  }
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

function firePurchase(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (localStorage.getItem(PURCHASE_TRACKED_KEY) === '1') return true;
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

    localStorage.setItem(PURCHASE_TRACKED_KEY, '1');
    clearStashedPurchaseParams();
    return true;
  } catch {
    return false;
  }
}

/** Fire Meta Purchase once per browser — /onboarding is the post-purchase conversion URL. */
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
