/**
 * Dry-run: 1 ScrapeCreators credit per company seed to verify Meta page names return ads.
 * Usage: npx tsx scripts/validate-seed-names.ts [limit]
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { getAdsDateRange } from '../lib/competitors/dates';
import { BRANDS_BY_CATEGORY } from '../lib/static-library/seeds-brands';

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
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

loadEnvLocal();

const key = process.env.SCRAPECREATORS_API_KEY?.trim();
if (!key) {
  console.error('SCRAPECREATORS_API_KEY missing');
  process.exit(1);
}

const dates = getAdsDateRange();
const limit = Number(process.argv[2]) || 0;
let n = 0;
let ok = 0;
let empty = 0;

for (const [category, names] of Object.entries(BRANDS_BY_CATEGORY)) {
  for (const name of names) {
    if (limit > 0 && n >= limit) break;
    n++;
    const url = new URL('https://api.scrapecreators.com/v1/facebook/adLibrary/company/ads');
    url.searchParams.set('companyName', name);
    url.searchParams.set('country', 'US');
    url.searchParams.set('status', 'ACTIVE');
    url.searchParams.set('media_type', 'MEME');
    url.searchParams.set('sort_by', 'total_impressions');
    url.searchParams.set('trim', 'true');
    url.searchParams.set('start_date', dates.start_date);

    const res = await fetch(url, { headers: { 'x-api-key': key } });
    const text = await res.text();
    let count = 0;
    let pageName = '';
    try {
      const data = JSON.parse(text) as { results?: { page_name?: string }[] };
      const results = data.results ?? [];
      count = results.length;
      pageName = results[0]?.page_name ?? '';
    } catch {
      count = -1;
    }
    const status = count > 0 ? 'OK' : count === 0 ? 'EMPTY' : 'ERR';
    if (count > 0) ok++;
    else empty++;
    console.log(`${status}\t${category}\t${name}\tads=${count}\tpage=${pageName}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

console.log(`\nChecked ${n} companies: ${ok} with ads, ${empty} empty/error`);
