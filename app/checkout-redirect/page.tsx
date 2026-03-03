'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function CheckoutRedirectContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plan) {
      setError('Missing plan');
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/checkout-url?plan=${encodeURIComponent(plan)}`, { credentials: 'include' });
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Invalid plan');
      }
    })();
    return () => { cancelled = true; };
  }, [plan]);

  if (error) {
    return (
      <main className="min-h-screen landing-dark flex flex-col items-center justify-center px-4 text-white">
        <p className="text-red-300">{error}</p>
        <a href="/#pricing" className="mt-4 text-sky-400 hover:underline">Back to pricing</a>
      </main>
    );
  }

  return (
    <main className="min-h-screen landing-dark flex flex-col items-center justify-center px-4 text-white">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      <p className="mt-4 text-sm text-white/80">Redirecting to checkout…</p>
    </main>
  );
}

const Fallback = () => (
  <main className="min-h-screen landing-dark flex flex-col items-center justify-center px-4 text-white">
    <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
    <p className="mt-4 text-sm text-white/80">Redirecting to checkout…</p>
  </main>
);

export default function CheckoutRedirectPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <CheckoutRedirectContent />
    </Suspense>
  );
}
