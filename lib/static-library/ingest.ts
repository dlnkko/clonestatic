import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdsDateRange } from '@/lib/competitors/dates';
import { adHasDisplayableImage } from '@/lib/competitors/normalize-ads';
import { fetchCompanyAds, fetchKeywordAds } from '@/lib/competitors/scrape-creators';
import { fetchImageWithRetry } from '@/lib/fetch-image';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractAdsFromRaw } from './extract';
import { MVP_SEEDS, orderedSeedsForIngest, seedMetaByKey } from './seeds-mvp';
import {
  extensionFromMime,
  staticAdStoragePath,
  uploadStaticAdImage,
} from './storage';
import type { IngestMode, IngestOptions, IngestResult, StaticAdSeed } from './types';

const BOOTSTRAP_MAX_CREDITS = 750;
const REFRESH_MAX_CREDITS = 500;
const BRAND_BOOTSTRAP_MAX_CREDITS = 3500;
const BRAND_REFRESH_MAX_CREDITS = 900;

const BOOTSTRAP_MAX_PAGES = 2;
const REFRESH_MAX_PAGES = 1;
const BRAND_COMPANY_PAGES = 8;
const BRAND_KEYWORD_PAGES = 4;
const BRAND_GENERIC_PAGES = 1;
const BRAND_REFRESH_COMPANY_PAGES = 2;
const BRAND_REFRESH_BRAND_KW_PAGES = 1;

type CreditBudget = { used: number; max: number };

function canSpend(budget: CreditBudget): boolean {
  return budget.used < budget.max;
}

function spend(budget: CreditBudget, n = 1): boolean {
  if (budget.used + n > budget.max) return false;
  budget.used += n;
  return true;
}

function isBrandMode(mode: IngestMode): boolean {
  return mode === 'brand_bootstrap' || mode === 'brand_refresh';
}

function maxPagesForSeed(mode: IngestMode, seed: StaticAdSeed, override?: number): number {
  if (override != null) return override;
  if (!isBrandMode(mode)) {
    return mode === 'bootstrap' ? BOOTSTRAP_MAX_PAGES : REFRESH_MAX_PAGES;
  }
  if (seed.seed_type === 'company') {
    return mode === 'brand_bootstrap' ? BRAND_COMPANY_PAGES : BRAND_REFRESH_COMPANY_PAGES;
  }
  if (seed.seed_type === 'keyword' && seed.brand_keyword) {
    return mode === 'brand_bootstrap' ? BRAND_KEYWORD_PAGES : BRAND_REFRESH_BRAND_KW_PAGES;
  }
  return BRAND_GENERIC_PAGES;
}

function defaultMaxCredits(mode: IngestMode): number {
  switch (mode) {
    case 'brand_bootstrap':
      return BRAND_BOOTSTRAP_MAX_CREDITS;
    case 'brand_refresh':
      return BRAND_REFRESH_MAX_CREDITS;
    case 'refresh':
      return REFRESH_MAX_CREDITS;
    default:
      return BOOTSTRAP_MAX_CREDITS;
  }
}

export async function ensureSeedsLoaded(supabase: SupabaseClient): Promise<StaticAdSeed[]> {
  const { count, error: countErr } = await supabase
    .from('static_ad_seeds')
    .select('*', { count: 'exact', head: true });

  if (countErr) throw new Error(countErr.message);

  const seen = new Set<string>();
  const rows: {
    seed_type: string;
    value: string;
    category: string;
    active: boolean;
    sort_order: number;
  }[] = [];
  for (const s of MVP_SEEDS) {
    const key = `${s.seed_type}:${s.value.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      seed_type: s.seed_type,
      value: s.value.trim(),
      category: s.category,
      active: true,
      sort_order: s.sort_order ?? rows.length + 1,
    });
  }
  const { error: upsertErr } = await supabase.from('static_ad_seeds').upsert(rows, {
    onConflict: 'seed_type,value',
  });
  if (upsertErr) console.warn('[static-library] seed upsert:', upsertErr.message);
  else if ((count ?? 0) > 0 && rows.length > (count ?? 0)) {
    console.log(`[static-library] synced ${rows.length} seeds (${count} were in DB)`);
  }

  return orderedSeedsForIngest();
}

export { orderedSeedsForIngest };

async function fetchPaginated(
  fetchPage: (cursor?: string) => Promise<{ results: unknown[]; cursor?: string }>,
  maxPages: number,
  budget: CreditBudget
): Promise<unknown[]> {
  const all: unknown[] = [];
  let cursor: string | undefined;
  for (let p = 0; p < maxPages; p++) {
    if (!spend(budget)) break;
    const page = await fetchPage(cursor);
    all.push(...page.results);
    if (!page.cursor || page.results.length === 0) break;
    cursor = page.cursor;
  }
  return all;
}

export async function runStaticLibraryIngest(
  options: IngestOptions = {}
): Promise<IngestResult> {
  const mode = options.mode ?? 'bootstrap';
  const maxCredits = options.maxCredits ?? defaultMaxCredits(mode);
  const globalMaxPages = options.maxPagesPerSeed;

  const period = getAdsDateRange();
  const periodKey = options.periodKey ?? period.periodKey;
  const dates = { start_date: period.start_date };

  const supabase = createAdminClient();
  const budget: CreditBudget = { used: 0, max: maxCredits };
  const meta = seedMetaByKey();

  const { data: runRow, error: runErr } = await supabase
    .from('static_ad_library_runs')
    .insert({
      period_key: periodKey,
      status: 'running',
    })
    .select('id')
    .single();

  if (runErr || !runRow) {
    throw new Error(runErr?.message ?? 'Failed to create ingest run');
  }

  const runId = runRow.id as string;
  let adsInserted = 0;
  let adsUpdated = 0;
  let adsSkipped = 0;

  const finish = async (
    status: 'completed' | 'failed',
    errorMessage?: string
  ): Promise<IngestResult> => {
    await supabase
      .from('static_ad_library_runs')
      .update({
        status,
        credits_used: budget.used,
        ads_inserted: adsInserted,
        ads_updated: adsUpdated,
        ads_skipped: adsSkipped,
        error_message: errorMessage?.slice(0, 500) ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return {
      runId,
      periodKey,
      creditsUsed: budget.used,
      adsInserted,
      adsUpdated,
      adsSkipped,
      status,
      error: errorMessage,
    };
  };

  try {
    await ensureSeedsLoaded(supabase);
    const seeds = orderedSeedsForIngest();
    console.log(
      `[static-library] ingest ${mode} period=${periodKey} seeds=${seeds.length} maxCredits=${maxCredits}`
    );

    const existingIds = new Set<string>();
    const { data: existing } = await supabase.from('static_ads').select('ad_archive_id');
    for (const row of existing ?? []) {
      if (row.ad_archive_id) existingIds.add(row.ad_archive_id);
    }

    const labelFilter = options.canonicalBrandLabels?.length
      ? new Set(options.canonicalBrandLabels.map((s) => s.trim().toLowerCase()))
      : null;

    for (const seed of seeds) {
      if (!canSpend(budget)) {
        console.warn('[static-library] credit budget exhausted');
        break;
      }

      const value = seed.value.trim();
      if (!value) continue;

      if (labelFilter) {
        const canonical = (seed.canonical_label ?? value).trim().toLowerCase();
        if (!labelFilter.has(canonical)) continue;
      }

      const fullMeta =
        meta.get(`${seed.seed_type}:${value.toLowerCase()}`) ?? seed;
      const maxPages = maxPagesForSeed(mode, fullMeta, globalMaxPages);
      const sourceType = seed.seed_type;

      let rawResults: unknown[] = [];

      try {
        if (sourceType === 'keyword') {
          rawResults = await fetchPaginated(
            (cursor) => fetchKeywordAds(value, dates, cursor),
            maxPages,
            budget
          );
        } else {
          rawResults = await fetchPaginated(
            (cursor) => fetchCompanyAds(value, dates, cursor),
            maxPages,
            budget
          );
        }
      } catch (err) {
        console.warn(`[static-library] scrape failed ${sourceType}="${value}"`, err);
        continue;
      }

      console.log(
        `[static-library] ${sourceType}="${value}" (${fullMeta.category}) pages≤${maxPages} raw=${rawResults.length}`
      );

      for (const raw of rawResults) {
        if (!adHasDisplayableImage(raw)) continue;

        const extracted = extractAdsFromRaw(raw, { requireArchiveId: true });
        for (const item of extracted) {
          if (existingIds.has(item.adArchiveId)) {
            adsSkipped += 1;
            continue;
          }

          const fetched = await fetchImageWithRetry(item.imageUrl, { maxAttempts: 3 });
          if (!fetched) {
            adsSkipped += 1;
            continue;
          }

          const ext = extensionFromMime(fetched.mimeType);
          const storagePath = staticAdStoragePath(periodKey, item.adArchiveId, ext);

          try {
            await uploadStaticAdImage(storagePath, fetched.buffer, fetched.mimeType);
          } catch (uploadErr) {
            console.warn('[static-library] upload skip', item.adArchiveId, uploadErr);
            adsSkipped += 1;
            continue;
          }

          const { error: upsertErr } = await supabase.from('static_ads').upsert(
            {
              ad_archive_id: item.adArchiveId,
              image_storage_path: storagePath,
              page_name: item.pageName,
              body_preview: item.bodyPreview,
              category: seed.category,
              source: sourceType,
              seed_label: value,
              period_key: periodKey,
              scraped_at: new Date().toISOString(),
              total_impressions: item.totalImpressions,
              metadata: {
                total_impressions: item.totalImpressions,
              },
            },
            { onConflict: 'ad_archive_id' }
          );

          if (upsertErr) {
            console.warn('[static-library] db upsert', upsertErr.message);
            adsSkipped += 1;
            continue;
          }

          existingIds.add(item.adArchiveId);
          adsInserted += 1;

          if (adsInserted % 50 === 0) {
            console.log(
              `[static-library] progress: ${adsInserted} inserted, ${budget.used} credits`
            );
          }
        }
      }
    }

    return finish('completed');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ingest failed';
    console.error('[static-library] ingest error:', err);
    return finish('failed', message);
  }
}

export async function getLatestLibraryRun() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('static_ad_library_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getLibraryAdCount(): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from('static_ads')
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}
