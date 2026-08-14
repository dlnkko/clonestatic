export const META_PIXEL_ID = '1310852860892585';

const PURCHASE_TRACKED_KEY = 'admirror_meta_purchase_tracked';

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

function firePurchase(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (localStorage.getItem(PURCHASE_TRACKED_KEY) === '1') return true;
    if (typeof window.fbq !== 'function') return false;
    window.fbq('track', 'Purchase', { currency: 'USD' });
    localStorage.setItem(PURCHASE_TRACKED_KEY, '1');
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
