import type { SupabaseClient } from '@supabase/supabase-js';
import { CREATIONS_RETENTION_DAYS } from './constants';

/** Generating jobs older than this are treated as failed (serverless after() never finished). */
export const STALE_GENERATING_MS = 12 * 60 * 1000;

export function creationsRetentionCutoff(): string {
  const d = new Date();
  d.setDate(d.getDate() - CREATIONS_RETENTION_DAYS);
  return d.toISOString();
}

/** Deletes creations older than retention window for one user. */
export async function purgeExpiredCreations(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  const cutoff = creationsRetentionCutoff();
  const { error } = await admin
    .from('creations')
    .delete()
    .eq('user_id', userId)
    .lt('created_at', cutoff);
  if (error) {
    console.error('purgeExpiredCreations:', error.message);
  }
}

/** Mark stuck "generating" rows as failed so History does not spin forever. */
export async function failStaleGeneratingCreations(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_GENERATING_MS).toISOString();
  const { error } = await admin
    .from('creations')
    .update({
      status: 'failed',
      error_message: 'Server error. Please try again shortly.',
    })
    .eq('user_id', userId)
    .eq('status', 'generating')
    .lt('created_at', cutoff);
  if (error) {
    console.error('failStaleGeneratingCreations:', error.message);
  }
}
