/**
 * Purge static ad library (Storage API + static_ads rows).
 * Supabase blocks DELETE on storage.objects — must use Storage API.
 *
 * Modes:
 *   bottom-impressions (default) — worst half by total_impressions (≈9.8k of 19.6k)
 *   small-brands — all ads from brands with at most N ads
 *
 * Usage:
 *   npx tsx scripts/purge-static-library-ads.ts
 *   npx tsx scripts/purge-static-library-ads.ts --apply
 *   npx tsx scripts/purge-static-library-ads.ts --apply --limit 9815
 *   npx tsx scripts/purge-static-library-ads.ts --mode small-brands --max-ads 4 --apply
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createAdminClient } from '../lib/supabase/admin';
import { STATIC_AD_BUCKET } from '../lib/static-library/storage';

type AdRow = { id: string; imagePath: string; pageName?: string };

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs() {
  const argv = process.argv.slice(2);
  let apply = false;
  let mode: 'bottom-impressions' | 'small-brands' = 'bottom-impressions';
  let maxAds = 4;
  let limit: number | null = null;
  let fraction = 0.5;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') apply = true;
    else if (a === '--mode' && argv[i + 1]) {
      mode = argv[i + 1] === 'small-brands' ? 'small-brands' : 'bottom-impressions';
      i++;
    } else if (a === '--max-ads' && argv[i + 1]) {
      maxAds = Math.max(1, parseInt(argv[i + 1], 10) || 4);
      i++;
    } else if (a === '--limit' && argv[i + 1]) {
      limit = Math.max(1, parseInt(argv[i + 1], 10) || 1);
      i++;
    } else if (a === '--fraction' && argv[i + 1]) {
      fraction = Math.min(1, Math.max(0.01, parseFloat(argv[i + 1]) || 0.5));
      i++;
    }
  }

  return { apply, mode, maxAds, limit, fraction };
}

async function fetchBottomImpressionAds(
  supabase: ReturnType<typeof createAdminClient>,
  deleteCount: number
): Promise<AdRow[]> {
  const out: AdRow[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (out.length < deleteCount) {
    const take = Math.min(pageSize, deleteCount - out.length);
    const { data, error } = await supabase
      .from('static_ads')
      .select('id, image_storage_path')
      .order('total_impressions', { ascending: true, nullsFirst: true })
      .order('scraped_at', { ascending: true })
      .range(offset, offset + take - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      const imagePath = row.image_storage_path?.trim();
      if (!imagePath) continue;
      out.push({ id: row.id, imagePath });
    }
    offset += data.length;
    if (data.length < take) break;
  }

  return out;
}

async function fetchSmallBrandAds(
  supabase: ReturnType<typeof createAdminClient>,
  maxAds: number
): Promise<AdRow[]> {
  const counts = new Map<string, number>();
  const pageSize = 1000;
  let offset = 0;

  // Paginate — Supabase caps at 1000 rows per request
  while (true) {
    const { data, error } = await supabase
      .from('static_ads')
      .select('page_name')
      .not('page_name', 'is', null)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      const name = row.page_name?.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  const smallBrandSet = new Set(
    [...counts.entries()].filter(([, n]) => n <= maxAds).map(([name]) => name)
  );

  if (smallBrandSet.size === 0) return [];

  const out: AdRow[] = [];
  offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('static_ads')
      .select('id, page_name, image_storage_path')
      .not('page_name', 'is', null)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      const pageName = row.page_name?.trim();
      const imagePath = row.image_storage_path?.trim();
      if (!pageName || !imagePath || !smallBrandSet.has(pageName)) continue;
      out.push({ id: row.id, imagePath, pageName });
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return out;
}

async function removeStoragePaths(
  supabase: ReturnType<typeof createAdminClient>,
  paths: string[]
): Promise<{ removed: number; errors: string[] }> {
  const unique = [...new Set(paths)];
  const batchSize = 100;
  let removed = 0;
  const errors: string[] = [];

  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const { data, error } = await supabase.storage.from(STATIC_AD_BUCKET).remove(batch);
    if (error) {
      errors.push(`batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      continue;
    }
    removed += data?.length ?? batch.length;
    process.stdout.write(`\r  Storage: ${Math.min(i + batch.length, unique.length)}/${unique.length}`);
  }
  process.stdout.write('\n');
  return { removed, errors };
}

async function deleteDbRows(
  supabase: ReturnType<typeof createAdminClient>,
  ids: string[]
): Promise<number> {
  const batchSize = 500;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { error, count } = await supabase
      .from('static_ads')
      .delete({ count: 'exact' })
      .in('id', batch);
    if (error) throw new Error(error.message);
    deleted += count ?? batch.length;
    process.stdout.write(`\r  DB rows: ${Math.min(i + batch.length, ids.length)}/${ids.length}`);
  }
  process.stdout.write('\n');
  return deleted;
}

async function main() {
  loadEnvLocal();
  const { apply, mode, maxAds, limit, fraction } = parseArgs();
  const supabase = createAdminClient();

  const { count: totalCount, error: countErr } = await supabase
    .from('static_ads')
    .select('*', { count: 'exact', head: true });
  if (countErr) throw new Error(countErr.message);

  const total = totalCount ?? 0;

  let rows: AdRow[] = [];
  let label = '';

  if (mode === 'small-brands') {
    label = `small brands (≤ ${maxAds} ads each)`;
    console.log(`\nMode: ${label}\n`);
    rows = await fetchSmallBrandAds(supabase, maxAds);
    const brands = new Set(rows.map((r) => r.pageName).filter(Boolean));
    console.log(`  Total ads in DB:  ${total}`);
    console.log(`  Brands affected:  ${brands.size}`);
  } else {
    const deleteCount = limit ?? Math.floor(total * fraction);
    label = limit
      ? `bottom ${limit} ads by impressions`
      : `bottom ${Math.round(fraction * 100)}% by impressions (${deleteCount} ads)`;
    console.log(`\nMode: ${label}\n`);
    console.log(`  Total ads in DB:  ${total}`);
    rows = await fetchBottomImpressionAds(supabase, deleteCount);
  }

  const paths = rows.map((r) => r.imagePath);
  const ids = rows.map((r) => r.id);

  console.log(`  Ads to remove:    ${rows.length}`);
  console.log(`  Storage files:    ${new Set(paths).size}`);
  console.log(`  Would remain:     ~${total - rows.length}`);

  if (rows.length === 0) {
    console.log('\nNothing to delete.\n');
    return;
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to delete.\n');
    const cmd =
      mode === 'small-brands'
        ? `npx tsx scripts/purge-static-library-ads.ts --mode small-brands --max-ads ${maxAds} --apply`
        : 'npx tsx scripts/purge-static-library-ads.ts --apply';
    console.log(`  ${cmd}\n`);
    return;
  }

  console.log('\nDeleting storage files...');
  const storageResult = await removeStoragePaths(supabase, paths);
  console.log(`  Removed (API): ${storageResult.removed}`);
  if (storageResult.errors.length) {
    console.warn('  Storage warnings:', storageResult.errors.slice(0, 5).join('; '));
  }

  console.log('Deleting database rows...');
  const deleted = await deleteDbRows(supabase, ids);
  console.log(`  Deleted rows: ${deleted}`);

  const { count } = await supabase
    .from('static_ads')
    .select('*', { count: 'exact', head: true });
  console.log(`\nRemaining ads in static_ads: ${count ?? '?'}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
