import type { SupabaseClient } from '@supabase/supabase-js';
import { BRANDS_BY_CATEGORY } from './seeds-brands';

export type BrandTarget = {
  label: string;
  category: string;
  source: 'seed' | 'db';
};

/** DB page names with at least minAds rows (likely real brands, not one-off keyword noise). */
export async function fetchDbBrandsWithMinAds(
  supabase: SupabaseClient,
  minAds: number
): Promise<{ label: string; category: string; adCount: number }[]> {
  const counts = new Map<string, { label: string; category: string; adCount: number }>();
  const pageSize = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('static_ads')
      .select('page_name, category')
      .not('page_name', 'is', null)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      const label = row.page_name?.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const cur = counts.get(key);
      if (cur) {
        cur.adCount += 1;
      } else {
        counts.set(key, {
          label,
          category: (row.category as string) || 'unknown',
          adCount: 1,
        });
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return [...counts.values()]
    .filter((b) => b.adCount >= minAds)
    .sort((a, b) => b.adCount - a.adCount || a.label.localeCompare(b.label));
}

export type ListBrandOptions = {
  /** Include DB page_name values not in seeds (can be many). Default false. */
  includeDbOrphans?: boolean;
  /** Min ads for orphan DB page names. Default 8. */
  minAdsForOrphans?: number;
};

/** Seed labels; optionally DB page names with enough ads. */
export async function listAllBrandTargets(
  supabase: SupabaseClient,
  options: ListBrandOptions = {}
): Promise<BrandTarget[]> {
  const includeDbOrphans = options.includeDbOrphans ?? false;
  const minAds = options.minAdsForOrphans ?? 8;

  const byKey = new Map<string, BrandTarget>();

  for (const [category, names] of Object.entries(BRANDS_BY_CATEGORY)) {
    for (const name of names) {
      const label = name.trim();
      if (!label) continue;
      byKey.set(label.toLowerCase(), { label, category, source: 'seed' });
    }
  }

  if (includeDbOrphans) {
    const dbPages = await fetchDbBrandsWithMinAds(supabase, minAds);
    for (const { label, category } of dbPages) {
      const key = label.toLowerCase();
      if (byKey.has(key)) continue;
      byKey.set(key, { label, category, source: 'db' });
    }
  }

  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Seed canonical labels only (for ingest filter). */
export function listSeedBrandLabels(): string[] {
  const labels = new Set<string>();
  for (const names of Object.values(BRANDS_BY_CATEGORY)) {
    for (const name of names) {
      const label = name.trim();
      if (label) labels.add(label);
    }
  }
  return [...labels].sort((a, b) => a.localeCompare(b));
}
