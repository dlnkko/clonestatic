'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isEntitledPlan } from '@/lib/plans';
import { POST_PURCHASE_ONBOARDING_KEY, POST_PURCHASE_ONBOARDING_PATH } from '@/lib/discovery-sources';

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
      if (subData?.ok && isEntitledPlan(subData.plan) && Number(subData.credits_remaining) > 0) {
        return true;
      }
    }
  } catch {
    /* ignore */
  }

  return false;
}

const STATUS_LINES = [
  'Confirming your payment…',
  'Unlocking your credits…',
  'Almost ready…',
];

function ActivatingScreen() {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_LINES.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#050810] px-4 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(34,211,238,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 70% 70%, rgba(99,102,241,0.14), transparent 50%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex max-w-sm flex-col items-center text-center">
        <div className="relative flex h-24 w-24 items-center justify-center" aria-hidden>
          <span className="post-purchase-ring absolute inset-0 rounded-full border border-cyan-400/25" />
          <span className="post-purchase-ring post-purchase-ring-delay absolute inset-2 rounded-full border border-indigo-400/30" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-indigo-500/25 ring-1 ring-white/15">
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-cyan-300" />
          </span>
        </div>

        <h1 className="mt-8 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Activating your subscription
        </h1>
        <p
          key={statusIndex}
          className="post-purchase-status mt-3 min-h-[1.25rem] text-sm text-white/65"
        >
          {STATUS_LINES[statusIndex]}
        </p>

        <div className="mt-8 h-1 w-48 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div className="post-purchase-bar h-full w-1/2 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400" />
        </div>

        <p className="mt-6 text-xs leading-relaxed text-white/40">
          This usually takes a few seconds. Don&apos;t close this page.
        </p>
      </div>
    </main>
  );
}

function PostPurchaseContent() {
  const searchParams = useSearchParams();
  const paymentId = readWhopPaymentId(searchParams);

  useEffect(() => {
    void markPendingCheckout(paymentId);

    try {
      sessionStorage.setItem(POST_PURCHASE_ONBOARDING_KEY, '1');
    } catch {
      /* ignore */
    }

    let redirected = false;
    const go = (path: string) => {
      if (redirected) return;
      redirected = true;
      window.location.replace(path);
    };

    const hardTimeout = window.setTimeout(() => {
      go(POST_PURCHASE_ONBOARDING_PATH);
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
          : POST_PURCHASE_ONBOARDING_PATH;
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
      go(POST_PURCHASE_ONBOARDING_PATH);
    };

    void finish();

    return () => {
      window.clearTimeout(hardTimeout);
    };
  }, [paymentId]);

  return <ActivatingScreen />;
}

/** Whop success URL target — activates subscription then sends user to dashboard or login. */
export default function PostPurchasePage() {
  return (
    <Suspense fallback={<ActivatingScreen />}>
      <PostPurchaseContent />
    </Suspense>
  );
}
