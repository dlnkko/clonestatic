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
 * Try to claim the 1 free trial for this IP.
 * Returns true if this IP had not used the free trial yet (and we inserted it).
 * Returns false if this IP already used the free trial (unique violation) or insert failed.
 */
export async function tryClaimFreeTrial(admin: SupabaseClient, ipHash: string): Promise<boolean> {
  const { data, error } = await admin
    .from(FREE_TRIAL_TABLE)
    .insert({ ip_hash: ipHash })
    .select('ip_hash')
    .single();
  if (error) {
    if (error.code === '23505') return false; // unique_violation = already used
    return false;
  }
  return !!data;
}

/**
 * Check if this IP has already used the free trial (read-only check).
 */
export async function hasUsedFreeTrial(admin: SupabaseClient, ipHash: string): Promise<boolean> {
  const { data, error } = await admin
    .from(FREE_TRIAL_TABLE)
    .select('ip_hash')
    .eq('ip_hash', ipHash)
    .maybeSingle();
  return !error && !!data;
}
