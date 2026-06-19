'use client';

import { Suspense, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { isEntitledPlan } from '@/lib/plans';
import { AdmirrorLogo } from '@/app/components/AdmirrorLogo';

function getOAuthRedirectOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://www.admirror.app';
}

function setAuthFlowCookies(next: string, plan: string) {
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const base = `path=/; max-age=600; samesite=lax${secure ? '; secure' : ''}`;
  document.cookie = `auth_next=${encodeURIComponent(next)}; ${base}`;
  if (plan) {
    document.cookie = `auth_plan=${encodeURIComponent(plan)}; ${base}`;
  }
}

async function activateWhopSubscriptionIfNeeded(nextPath: string): Promise<boolean> {
  let pending = false;
  let paymentId: string | null = null;
  try {
    pending =
      sessionStorage.getItem('pending_whop_checkout') === '1' ||
      new URLSearchParams(window.location.search).get('from') === 'whop';
    paymentId = sessionStorage.getItem('whop_payment_id');
    if (!paymentId && nextPath.includes('payment_id=')) {
      try {
        const nextUrl = new URL(nextPath, window.location.origin);
        paymentId =
          nextUrl.searchParams.get('payment_id') ?? nextUrl.searchParams.get('receipt_id');
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  if (!pending) return false;

  try {
    await fetch('/api/subscription/mark-checkout', { method: 'POST', credentials: 'include' });
  } catch {
    /* ignore */
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const syncRes = await fetch('/api/subscription/sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentId?.startsWith('pay_') ? { payment_id: paymentId } : {}),
      });
      if (syncRes.ok) {
        try {
          sessionStorage.removeItem('pending_whop_checkout');
          sessionStorage.removeItem('whop_payment_id');
        } catch {
          /* ignore */
        }
        return true;
      }

      const subRes = await fetch('/api/subscription', { credentials: 'include' });
      if (subRes.ok) {
        const subData = await subRes.json();
        if (subData?.ok && isEntitledPlan(subData.plan) && Number(subData.credits_remaining) > 0) {
          try {
            sessionStorage.removeItem('pending_whop_checkout');
            sessionStorage.removeItem('whop_payment_id');
          } catch {
            /* ignore */
          }
          return true;
        }
      }
    } catch {
      /* retry */
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  return false;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '';
  const plan = searchParams.get('plan') ?? '';
  const error = searchParams.get('error');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      await activateWhopSubscriptionIfNeeded(next || '/app');

      if (next === 'checkout' && plan) {
        window.location.replace(`/checkout-redirect?plan=${encodeURIComponent(plan)}`);
        return;
      }

      const dest = next && next.startsWith('/') ? next : '/app';
      window.location.replace(dest);
    });
  }, [next, plan]);

  const handleSignInWithGoogle = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = getOAuthRedirectOrigin();
      const destNext = next || '/app';

      setAuthFlowCookies(destNext, plan);

      const callbackParams = new URLSearchParams();
      callbackParams.set('next', destNext);
      if (plan) callbackParams.set('plan', plan);

      const redirectTo = `${origin}/auth/callback?${callbackParams.toString()}`;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (oauthError) throw oauthError;
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const isCheckout = next === 'checkout';

  return (
    <main className="min-h-screen landing-dark landing-dark-grid flex flex-col items-center justify-center px-4 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur-sm">
        <div className="mb-6 flex justify-center">
          <AdmirrorLogo theme="light" size="md" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">
          {isCheckout ? 'Sign in to continue to checkout' : 'Sign in'}
        </h1>
        <p className="mt-2 text-sm text-white/70">
          {isCheckout
            ? 'Use your Google account. After signing in you’ll go straight to Whop checkout.'
            : 'Use your Google account to access the dashboard.'}
        </p>
        {error && (
          <p className="mt-4 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">
            Sign-in failed. Please try again.
          </p>
        )}
        <button
          type="button"
          onClick={handleSignInWithGoogle}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </>
          )}
        </button>
      </div>
      <a href="/" className="mt-6 text-sm text-white/60 hover:text-white">
        ← Back to home
      </a>
      <p className="mt-6 text-center text-xs text-white/40">
        <a href="/terms" className="underline underline-offset-2 hover:text-white/60">
          Terms of Service
        </a>
        {' · '}
        <a href="/privacy" className="underline underline-offset-2 hover:text-white/60">
          Privacy Policy
        </a>
      </p>
    </main>
  );
}

const Fallback = () => (
  <main className="min-h-screen landing-dark landing-dark-grid flex flex-col items-center justify-center px-4 text-white">
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur-sm">
      <div className="h-6 w-32 animate-pulse rounded bg-white/20" />
      <div className="mt-2 h-4 w-full animate-pulse rounded bg-white/10" />
      <div className="mt-6 h-12 w-full animate-pulse rounded-xl bg-white/10" />
    </div>
  </main>
);

export default function LoginPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <LoginContent />
    </Suspense>
  );
}
