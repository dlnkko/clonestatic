import type { SupabaseClient } from '@supabase/supabase-js';
import { CREATIONS_RETENTION_DAYS } from './constants';
import { syncGeneratingCreationsFromKie } from './sync-kie-task';

/** Generating jobs with no Kie task id after this → failed (server never started image job). */
export const STALE_GENERATING_MS = 8 * 60 * 1000;

/** With a Kie task id, wait much longer — image may still complete after serverless cutoff. */
export const STALE_GENERATING_WITH_TASK_MS = 2 * 60 * 60 * 1000;

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
  // Pull any finished Kie jobs into completed before marking anything failed.
  await syncGeneratingCreationsFromKie(admin, userId);

  const cutoffNoTask = new Date(Date.now() - STALE_GENERATING_MS).toISOString();
  const { error: errNoTask } = await admin
    .from('creations')
    .update({
      status: 'failed',
      error_message: 'Server error. Please try again shortly.',
    })
    .eq('user_id', userId)
    .eq('status', 'generating')
    .is('kie_task_id', null)
    .lt('created_at', cutoffNoTask);
  if (errNoTask) {
    console.error('failStaleGeneratingCreations (no task):', errNoTask.message);
  }

  const cutoffWithTask = new Date(Date.now() - STALE_GENERATING_WITH_TASK_MS).toISOString();
  const { error: errWithTask } = await admin
    .from('creations')
    .update({
      status: 'failed',
      error_message: 'Server error. Please try again shortly.',
      kie_task_id: null,
    })
    .eq('user_id', userId)
    .eq('status', 'generating')
    .not('kie_task_id', 'is', null)
    .lt('created_at', cutoffWithTask);
  if (errWithTask) {
    console.error('failStaleGeneratingCreations (with task):', errWithTask.message);
  }
}
