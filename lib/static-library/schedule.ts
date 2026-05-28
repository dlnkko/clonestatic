import { createAdminClient } from '@/lib/supabase/admin';

/** Scheduled refresh interval (not calendar month). */
export const INGEST_INTERVAL_DAYS = 28;
export const INGEST_INTERVAL_MS = INGEST_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

export async function getLastCompletedIngestAt(): Promise<Date | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('static_ad_library_runs')
    .select('finished_at')
    .eq('status', 'completed')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.finished_at) return null;
  const d = new Date(data.finished_at);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function shouldRunScheduledIngest(): Promise<{
  run: boolean;
  reason: string;
  lastRunAt: string | null;
}> {
  const last = await getLastCompletedIngestAt();
  if (!last) {
    return { run: true, reason: 'no_prior_completed_run', lastRunAt: null };
  }

  const elapsed = Date.now() - last.getTime();
  if (elapsed >= INGEST_INTERVAL_MS) {
    return {
      run: true,
      reason: `interval_elapsed_${INGEST_INTERVAL_DAYS}d`,
      lastRunAt: last.toISOString(),
    };
  }

  const daysLeft = Math.ceil((INGEST_INTERVAL_MS - elapsed) / (24 * 60 * 60 * 1000));
  return {
    run: false,
    reason: `next_run_in_${daysLeft}d`,
    lastRunAt: last.toISOString(),
  };
}
