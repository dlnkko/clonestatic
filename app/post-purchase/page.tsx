'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

async function markPendingCheckout(): Promise<void> {
  try {
    sessionStorage.setItem('pending_whop_checkout', '1');
  } catch {
    /* ignore */
  }
  try {
    await fetch('/api/subscription/mark-checkout', { method: 'POST', credentials: 'include' });
  } catch {
    /* cookie set on next checkout-url if needed */
  }
}

async function syncUntilActive(): Promise<boolean> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const syncRes = await fetch('/api/subscription/sync', {
        method: 'POST',
        credentials: 'include',
      });
      if (syncRes.ok) return true;

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
      /* retry */
    }
    if (attempt < 7) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
  }
  return false;
}

/** Whop success URL target — activates subscription then sends user to dashboard or login. */
export default function PostPurchasePage() {
  useEffect(() => {
    void markPendingCheckout();

    const finish = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await syncUntilActive();
        window.location.replace('/app');
        return;
      }

      window.location.replace('/login?next=/app&from=whop');
    };

    void finish();
  }, []);

  return (
    <main className="min-h-screen landing-dark flex flex-col items-center justify-center px-4 text-white">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      <p className="mt-4 text-sm text-white/80">Activating your subscription…</p>
    </main>
  );
}
