'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingWelcome } from '@/app/components/OnboardingWelcome';
import { POST_PURCHASE_ONBOARDING_KEY } from '@/lib/discovery-sources';

export default function PostPurchaseOnboardingPage() {
  const router = useRouter();
  const [hasProducts, setHasProducts] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem(POST_PURCHASE_ONBOARDING_KEY);
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
  }, []);

  const goApp = (addProduct = false) => {
    router.replace(addProduct ? '/app?addProduct=1' : '/app');
  };

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <OnboardingWelcome
        open
        postPurchase
        hasProducts={hasProducts}
        onUpload={() => goApp(true)}
        onSkip={() => goApp(false)}
        onComplete={() => {
          try {
            sessionStorage.removeItem(POST_PURCHASE_ONBOARDING_KEY);
          } catch {
            /* ignore */
          }
        }}
      />
    </main>
  );
}
