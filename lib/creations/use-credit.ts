import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getClientIpHash, tryClaimFreeTrial } from '@/lib/free-trial';
import { resolveBillingEmail } from '@/lib/team-members';

export type UseCreditResult =
  | { ok: true; billingEmail?: string }
  | { ok: false; status: number; error: string; credits_remaining?: number };

export async function useCreditForGeneration(
  request: NextRequest,
  admin: SupabaseClient,
  email: string,
  isOwner: boolean
): Promise<UseCreditResult> {
  if (isOwner) return { ok: true };

  const { billingEmail } = await resolveBillingEmail(admin, email);

  let { data: row, error: fetchError } = await admin
    .from('subscriptions')
    .select('credits_remaining, plan')
    .eq('email', billingEmail)
    .maybeSingle();

  if (!row || fetchError) {
    const { syncWhopSubscriptionForEmailWithRetries } = await import('@/lib/whop');
    const syncResult = await syncWhopSubscriptionForEmailWithRetries(billingEmail, {
      maxAttempts: 3,
      delayMs: 1500,
    });
    if (syncResult.ok) {
      const refreshed = await admin
        .from('subscriptions')
        .select('credits_remaining, plan')
        .eq('email', billingEmail)
        .maybeSingle();
      row = refreshed.data;
      fetchError = refreshed.error;
    }
  }

  const hasSubscription = Boolean(row) && !fetchError;
  const current = row ? Math.max(0, row.credits_remaining ?? 0) : 0;

  if (hasSubscription && current >= 1) {
    const { error: updateError } = await admin
      .from('subscriptions')
      .update({
        credits_remaining: current - 1,
        updated_at: new Date().toISOString(),
      })
      .eq('email', billingEmail);
    if (updateError) {
      console.error('use-credit:', updateError);
      return { ok: false, status: 500, error: 'Failed to use credit' };
    }
    return { ok: true, billingEmail };
  }

  if (billingEmail !== email.trim().toLowerCase()) {
    return {
      ok: false,
      status: 402,
      error: 'No credits remaining on the team plan',
      credits_remaining: 0,
    };
  }

  const ipHash = getClientIpHash(request);
  const claimed = await tryClaimFreeTrial(admin, ipHash);
  if (!claimed) {
    return {
      ok: false,
      status: 402,
      error: 'No credits remaining',
      credits_remaining: 0,
    };
  }
  return { ok: true };
}
