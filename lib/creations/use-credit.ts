import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getClientIpHash, tryClaimFreeTrial } from '@/lib/free-trial';

export type UseCreditResult =
  | { ok: true }
  | { ok: false; status: number; error: string; credits_remaining?: number };

export async function useCreditForGeneration(
  request: NextRequest,
  admin: SupabaseClient,
  email: string,
  isOwner: boolean
): Promise<UseCreditResult> {
  if (isOwner) return { ok: true };

  const { data: row, error: fetchError } = await admin
    .from('subscriptions')
    .select('credits_remaining')
    .eq('email', email)
    .single();

  const hasSubscription = !fetchError && row;
  const current = hasSubscription ? Math.max(0, row.credits_remaining ?? 0) : 0;

  if (hasSubscription && current >= 1) {
    const { error: updateError } = await admin
      .from('subscriptions')
      .update({
        credits_remaining: current - 1,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email);
    if (updateError) {
      console.error('use-credit:', updateError);
      return { ok: false, status: 500, error: 'Failed to use credit' };
    }
    return { ok: true };
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
