'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function readWhopPaymentId(searchParams: URLSearchParams): string | null {
  for (const key of ['payment_id', 'receipt_id']) {
    const value = searchParams.get(key)?.trim();
    if (value?.startsWith('pay_')) return value;
  }
  return null;
}

async function markPendingCheckout(paymentId: string | null): Promise<void> {
  try {
    sessionStorage.setItem('pending_whop_checkout', '1');
    if (paymentId) {
      sessionStorage.setItem('whop_payment_id', paymentId);
    }
  } catch {
    /* ignore */
  }
  try {
    await fetch('/api/subscription/mark-checkout', { method: 'POST', credentials: 'include' });
  } catch {
    /* ignore */
  }
}

async function tryActivate(paymentId: string | null): Promise<boolean> {
  try {
    const syncRes = await fetch('/api/subscription/sync', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentId ? { payment_id: paymentId } : {}),
    });
    if (syncRes.ok) return true;
  } catch {
    /* retry below */
  }

  try {
    const subRes = await fetch('/api/subscription', { credentials: 'include' });
    if (subRes.ok) {
      const subData = await subRes.json();
      if (
        subData?.ok &&
        subData.plan !== 'free_trial' &&
        subData.plan !== 'owner' &&
        Number(subData.credits_remaining) > 0
      ) {
        return true;
      }
    }
  } catch {
    /* ignore */
  }

  return false;
}

function PostPurchaseContent() {
  const searchParams = useSearchParams();
  const paymentId = readWhopPaymentId(searchParams);

  useEffect(() => {
    void markPendingCheckout(paymentId);

    let redirected = false;
    const go = (path: string) => {
      if (redirected) return;
      redirected = true;
      window.location.replace(path);
    };

    const hardTimeout = window.setTimeout(() => {
      go('/app');
    }, 12000);

    const finish = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.clearTimeout(hardTimeout);
        const loginNext = paymentId
          ? `/post-purchase?payment_id=${encodeURIComponent(paymentId)}`
          : '/app';
        go(`/login?next=${encodeURIComponent(loginNext)}&from=whop`);
        return;
      }

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const active = await tryActivate(paymentId);
        if (active) break;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      window.clearTimeout(hardTimeout);
      go('/app');
    };

    void finish();

    return () => {
      window.clearTimeout(hardTimeout);
    };
  }, [paymentId]);

  return (
    <main className="min-h-screen landing-dark flex flex-col items-center justify-center px-4 text-white">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      <p className="mt-4 text-sm text-white/80">Activating your subscription…</p>
    </main>
  );
}

const Fallback = () => (
  <main className="min-h-screen landing-dark flex flex-col items-center justify-center px-4 text-white">
    <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
    <p className="mt-4 text-sm text-white/80">Activating your subscription…</p>
  </main>
);

/** Whop success URL target — activates subscription then sends user to dashboard or login. */
export default function PostPurchasePage() {
  return (
    <Suspense fallback={<Fallback />}>
      <PostPurchaseContent />
    </Suspense>
  );
}
