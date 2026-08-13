'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingWelcome } from '@/app/components/OnboardingWelcome';
import {
  hasCompletedPostPurchaseOnboarding,
  markPostPurchaseOnboardingComplete,
  POST_PURCHASE_ONBOARDING_KEY,
} from '@/lib/discovery-sources';

export default function PostPurchaseOnboardingPage() {
  const router = useRouter();
  const [hasProducts, setHasProducts] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem(POST_PURCHASE_ONBOARDING_KEY);
      sessionStorage.removeItem('pending_whop_checkout');
      sessionStorage.removeItem('whop_payment_id');
      if (hasCompletedPostPurchaseOnboarding()) {
        router.replace('/app');
        return;
      }
    } catch {
      /* ignore */
    }

    const w = window as Window & { dataLayer?: Record<string, unknown>[] };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event: 'post_purchase_onboarding', page: '/onboarding' });

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/products', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const list = data?.products;
          if (!cancelled) setHasProducts(Array.isArray(list) && list.length > 0);
        }
      } catch {
        /* continue without products */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const goApp = (addProduct = false) => {
    markPostPurchaseOnboardingComplete();
    router.replace(addProduct ? '/app?addProduct=1' : '/app');
  };

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050810]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-cyan-300" />
      </main>
    );
  }

  return (
    <OnboardingWelcome
      hasProducts={hasProducts}
      onUpload={() => goApp(true)}
      onSkip={() => goApp(false)}
    />
  );
}
