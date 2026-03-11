import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

const FREE_TRIAL_TABLE = 'free_trial_ips';

/**
 * Get client IP from request headers (Vercel/proxy use x-forwarded-for or x-real-ip).
 * Returns hashed IP for privacy; same IP always produces same hash.
 */
export function getClientIpHash(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = (forwarded?.split(',')[0]?.trim() || realIp?.trim() || 'unknown').slice(0, 64);
  return createHash('sha256').update(ip).digest('hex');
}

/**
 * Try to claim ONE free-trial generation for this IP.
 *
 * We allow up to 2 total free uses per IP:
 * - On first claim: create row with uses_remaining = 1 (2 - 1)
 * - On second claim: decrement uses_remaining from 1 → 0
 * - After that: return false (no free-trial credits left)
 */
export async function tryClaimFreeTrial(admin: SupabaseClient, ipHash: string): Promise<boolean> {
  // Fetch current uses_remaining if any.
  const { data: existing, error: fetchError } = await admin
    .from(FREE_TRIAL_TABLE)
    .select('ip_hash, uses_remaining')
    .eq('ip_hash', ipHash)
    .maybeSingle();

  if (fetchError) {
    console.error('tryClaimFreeTrial fetch error:', fetchError);
    return false;
  }

  if (!existing) {
    // First ever claim for this IP: create with uses_remaining = 1 (2 total - this one).
    const { error: insertError } = await admin
      .from(FREE_TRIAL_TABLE)
      .insert({ ip_hash: ipHash, uses_remaining: 1 });
    if (insertError) {
      console.error('tryClaimFreeTrial insert error:', insertError);
      return false;
    }
    return true;
  }

  const remaining = Math.max(0, existing.uses_remaining ?? 0);
  if (remaining < 1) {
    // No free-trial credits left.
    return false;
  }

  const { error: updateError } = await admin
    .from(FREE_TRIAL_TABLE)
    .update({ uses_remaining: remaining - 1, used_at: new Date().toISOString() })
    .eq('ip_hash', ipHash);
  if (updateError) {
    console.error('tryClaimFreeTrial update error:', updateError);
    return false;
  }
  return true;
}

/**
 * Get remaining free-trial generations for this IP.
 * Returns 2 if there is no row yet (never used), or the current uses_remaining otherwise.
 */
export async function getFreeTrialRemaining(admin: SupabaseClient, ipHash: string): Promise<number> {
  const { data, error } = await admin
    .from(FREE_TRIAL_TABLE)
    .select('uses_remaining')
    .eq('ip_hash', ipHash)
    .maybeSingle();

  if (error) {
    console.error('getFreeTrialRemaining error:', error);
    return 0;
  }
  if (!data) return 2;
  return Math.max(0, data.uses_remaining ?? 0);
}
