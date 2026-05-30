import type { SupabaseClient } from '@supabase/supabase-js';
import { sortBrandsByPriority } from './priority-brands';
import { publicStorageUrl } from './storage';
import type { StaticAdRow } from './types';

export type LibraryBrandDto = {
  brandName: string;
  adCount: number;
  maxImpressions: number | null;
};

export type LibraryAdDto = {
  id: string;
  adArchiveId: string;
  imageUrl: string;
  pageName: string | null;
  bodyPreview: string | null;
  category: string;
  source: string;
  seedLabel: string;
  scrapedAt: string;
  totalImpressions: number | null;
};

export function rowToDto(row: StaticAdRow): LibraryAdDto {
  return {
    id: row.id,
    adArchiveId: row.ad_archive_id,
    imageUrl: publicStorageUrl(row.image_storage_path),
    pageName: row.page_name,
    bodyPreview: row.body_preview,
    category: row.category,
    source: row.source,
    seedLabel: row.seed_label,
    scrapedAt: row.scraped_at,
    totalImpressions:
      typeof row.total_impressions === 'number' ? row.total_impressions : null,
  };
}

export async function queryStaticLibrary(
  supabase: SupabaseClient,
  params: {
    category?: string | null;
    brand?: string | null;
    keyword?: string | null;
    cursor?: string | null;
    limit?: number;
  }
): Promise<{
  ads: LibraryAdDto[];
  nextCursor: string | null;
  sort: 'impressions' | 'scraped_at';
  filteredCount: number | null;
}> {
  const limit = Math.min(Math.max(params.limit ?? 48, 1), 100);

  const base = supabase
    .from('static_ads')
    .select(
      'id, ad_archive_id, image_storage_path, page_name, body_preview, category, source, seed_label, scraped_at, total_impressions'
    );

  // Default sort should be "top impressions", but older DBs may not have the column yet.
  const buildQuery = (sort: 'impressions' | 'scraped_at') => {
    let q = base;
    if (sort === 'impressions') {
      q = q
        .order('total_impressions', { ascending: false, nullsFirst: false })
        .order('scraped_at', { ascending: false })
        .order('id', { ascending: false });
    } else {
      q = q.order('scraped_at', { ascending: false }).order('id', { ascending: false });
    }
    return q;
  };

  if (params.category && params.category !== 'all') {
    // apply to both attempts (query builder clones server-side)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }

  const offset = params.cursor ? Math.max(0, parseInt(params.cursor, 10) || 0) : 0;
  const applyFilters = (q: ReturnType<typeof buildQuery>) => {
    if (params.category && params.category !== 'all') {
      q = q.eq('category', params.category);
    }
    if (params.brand?.trim()) {
      q = q.eq('page_name', params.brand.trim());
    }
    if (params.keyword?.trim()) {
      const kw = params.keyword.trim().replace(/[%_,]/g, ' ');
      const pattern = `%${kw}%`;
      q = q.or(
        `seed_label.ilike.${pattern},page_name.ilike.${pattern},body_preview.ilike.${pattern}`
      );
    }
    return q.range(offset, offset + limit);
  };

  const applyFiltersCount = (q: ReturnType<typeof supabase.from>) => {
    let query = q.select('id', { count: 'exact', head: true });
    if (params.category && params.category !== 'all') {
      query = query.eq('category', params.category);
    }
    if (params.brand?.trim()) {
      query = query.eq('page_name', params.brand.trim());
    }
    if (params.keyword?.trim()) {
      const kw = params.keyword.trim().replace(/[%_,]/g, ' ');
      const pattern = `%${kw}%`;
      query = query.or(
        `seed_label.ilike.${pattern},page_name.ilike.${pattern},body_preview.ilike.${pattern}`
      );
    }
    return query;
  };

  let sort: 'impressions' | 'scraped_at' = 'impressions';
  let data: unknown[] | null = null;

  // Attempt 1: sort by total_impressions (best).
  {
    const q1 = applyFilters(buildQuery('impressions'));
    const res1 = await q1;
    if (!res1.error) {
      data = res1.data as unknown[];
    } else if (/total_impressions.*does not exist/i.test(res1.error.message)) {
      // Fallback for DBs that haven't applied the impressions migration yet.
      sort = 'scraped_at';
    } else {
      throw new Error(res1.error.message);
    }
  }

  // Attempt 2: fallback sort by scraped_at.
  if (data == null) {
    const q2 = applyFilters(buildQuery('scraped_at'));
    const res2 = await q2;
    if (res2.error) throw new Error(res2.error.message);
    data = res2.data as unknown[];
  }

  const rows = (data ?? []) as StaticAdRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(offset + limit) : null;

  let filteredCount: number | null = null;
  try {
    const countRes = await applyFiltersCount(supabase.from('static_ads'));
    if (!countRes.error && countRes.count != null) {
      filteredCount = countRes.count;
    }
  } catch {
    // optional count
  }

  return {
    ads: page.map(rowToDto),
    nextCursor,
    sort,
    filteredCount,
  };
}

async function queryLibraryBrandsFallback(
  supabase: SupabaseClient,
  category: string
): Promise<LibraryBrandDto[]> {
  const map = new Map<string, { adCount: number; maxImpressions: number | null }>();
  const pageSize = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('static_ads')
      .select('page_name, total_impressions')
      .eq('category', category)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      const name = row.page_name?.trim();
      if (!name) continue;
      const imp =
        typeof row.total_impressions === 'number' ? row.total_impressions : null;
      const cur = map.get(name) ?? { adCount: 0, maxImpressions: null };
      cur.adCount += 1;
      if (imp != null && (cur.maxImpressions == null || imp > cur.maxImpressions)) {
        cur.maxImpressions = imp;
      }
      map.set(name, cur);
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return [...map.entries()]
    .map(([brandName, stats]) => ({
      brandName,
      adCount: stats.adCount,
      maxImpressions: stats.maxImpressions,
    }))
    .sort((a, b) => {
      const ai = a.maxImpressions ?? 0;
      const bi = b.maxImpressions ?? 0;
      if (bi !== ai) return bi - ai;
      if (b.adCount !== a.adCount) return b.adCount - a.adCount;
      return a.brandName.localeCompare(b.brandName);
    });
}

export async function queryLibraryBrands(
  supabase: SupabaseClient,
  category: string,
  search?: string | null
): Promise<LibraryBrandDto[]> {
  let brands: LibraryBrandDto[];

  const { data, error } = await supabase.rpc('library_brands_by_category', {
    p_category: category,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('library_brands_by_category') ||
      msg.includes('does not exist') ||
      msg.includes('could not find the function')
    ) {
      brands = await queryLibraryBrandsFallback(supabase, category);
    } else {
      throw new Error(error.message);
    }
  } else {
    brands = (
      (data ?? []) as {
        brand_name: string;
        ad_count: number | string;
        max_impressions: number | string | null;
      }[]
    ).map((r) => ({
      brandName: r.brand_name,
      adCount: Number(r.ad_count) || 0,
      maxImpressions:
        r.max_impressions != null && r.max_impressions !== ''
          ? Number(r.max_impressions)
          : null,
    }));
  }

  const needle = search?.trim().toLowerCase();
  if (needle) {
    brands = brands.filter((b) => b.brandName.toLowerCase().includes(needle));
  }

  return sortBrandsByPriority(category, brands);
}

export async function getLibraryCategories(supabase: SupabaseClient): Promise<string[]> {
  // Use seeds (small table) to avoid the default 1k row cap of static_ads selects.
  const { data, error } = await supabase
    .from('static_ad_seeds')
    .select('category')
    .eq('active', true);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.category) set.add(row.category);
  }
  return [...set].sort();
}
