'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Whop success URL target — activates subscription then sends user to dashboard or login. */
export default function PostPurchasePage() {
  useEffect(() => {
    try {
      sessionStorage.setItem('pending_whop_checkout', '1');
    } catch {
      /* ignore */
    }

    const finish = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            const res = await fetch('/api/subscription/sync', {
              method: 'POST',
              credentials: 'include',
            });
            if (res.ok) break;
          } catch {
            /* retry */
          }
          if (attempt < 4) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
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
