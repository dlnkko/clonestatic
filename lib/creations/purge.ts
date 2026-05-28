import type { SupabaseClient } from '@supabase/supabase-js';
import { CREATIONS_RETENTION_DAYS } from './constants';

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
