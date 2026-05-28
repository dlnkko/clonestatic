/**
 * Resolve Meta Ad Library page names via Gemini 3.5 Flash + Google Search.
 *
 * Usage:
 *   npx tsx scripts/resolve-brand-page-names.ts              # known failures + corrections retry
 *   npx tsx scripts/resolve-brand-page-names.ts --probe      # probe all brands (1 ScrapeCreators credit each)
 *   npx tsx scripts/resolve-brand-page-names.ts --include-zero  # also Gemini for zero_ads after probe
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { costFromUsage, mergeStep2Usage } from '../lib/adaptation/cost';
import type { Step2Usage } from '../lib/adaptation/types';
import { BRANDS_BY_CATEGORY } from '../lib/static-library/seeds-brands';
import { probeCompanyPage } from '../lib/static-library/probe-company-page';
import { resolveFacebookPageNameWithSearch } from '../lib/static-library/resolve-page-name';

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

const CORRECTIONS_PATH = resolve(process.cwd(), 'lib/static-library/brand-page-corrections.json');
const PROBE_CACHE_PATH = resolve(process.cwd(), '.cache/brand-probe-cache.json');

const KNOWN_PAGE_ID_FAILURES = [
  'Avocado Green Mattress',
  'Sundays for Dogs',
  'Daring Foods',
  'Billie',
];

type ProbeCache = Record<
  string,
  { status: string; adCount: number; samplePageName: string | null; at: string }
>;

function readCorrections(): Record<string, string> {
  const raw = JSON.parse(readFileSync(CORRECTIONS_PATH, 'utf8')) as {
    corrections?: Record<string, string>;
  };
  return raw.corrections ?? {};
}

function writeCorrections(corrections: Record<string, string>) {
  writeFileSync(
    CORRECTIONS_PATH,
    JSON.stringify({ _comment: 'seed label → Meta page name', corrections }, null, 2) + '\n',
    'utf8'
  );
}

function readProbeCache(): ProbeCache {
  if (!existsSync(PROBE_CACHE_PATH)) return {};
  return JSON.parse(readFileSync(PROBE_CACHE_PATH, 'utf8')) as ProbeCache;
}

function writeProbeCache(cache: ProbeCache) {
  const dir = resolve(process.cwd(), '.cache');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(PROBE_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

function allBrands(): { label: string; category: string }[] {
  const out: { label: string; category: string }[] = [];
  for (const [category, names] of Object.entries(BRANDS_BY_CATEGORY)) {
    for (const name of names) {
      out.push({ label: name.trim(), category });
    }
  }
  return out;
}

function parseIngestLogFailures(logPath: string): string[] {
  if (!existsSync(logPath)) return [];
  const text = readFileSync(logPath, 'utf8');
  const found = new Set<string>();
  const re = /No pageId found for company: ([^\n"]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.add(m[1].trim());
  }
  return [...found];
}

async function main() {
  const args = process.argv.slice(2);
  const doProbe = args.includes('--probe');
  const includeZero = args.includes('--include-zero');
  const logArg = args.find((a) => a.startsWith('--log='));
  const logPath = logArg?.slice('--log='.length);

  let corrections = readCorrections();
  const brands = allBrands();
  let probeCache = readProbeCache();
  let scrapeCredits = 0;
  const usages: (Step2Usage | null)[] = [];

  const targets = new Set<string>(KNOWN_PAGE_ID_FAILURES);
  if (logPath) {
    for (const b of parseIngestLogFailures(logPath)) targets.add(b);
  }

  if (doProbe) {
    console.log(`[resolve] Probing ${brands.length} brands (1 ScrapeCreators credit each)…`);
    for (const { label, category } of brands) {
      const attempt = corrections[label] ?? label;
      const cached = probeCache[label];
      if (cached?.at && Date.now() - new Date(cached.at).getTime() < 7 * 86400000) {
        if (cached.status === 'page_id_not_found') targets.add(label);
        if (includeZero && cached.status === 'zero_ads') targets.add(label);
        continue;
      }
      const probe = await probeCompanyPage(attempt);
      scrapeCredits += 1;
      probeCache[label] = {
        status: probe.status,
        adCount: probe.adCount,
        samplePageName: probe.samplePageName,
        at: new Date().toISOString(),
      };
      console.log(
        `[probe] ${category}\t${label}\t→ ${probe.status} (${probe.adCount} ads) tried="${attempt}"`
      );
      if (probe.status === 'page_id_not_found') targets.add(label);
      if (includeZero && probe.status === 'zero_ads') targets.add(label);
      await new Promise((r) => setTimeout(r, 250));
    }
    writeProbeCache(probeCache);
  }

  const toResolve = [...targets].filter((label) => {
    const current = corrections[label];
    if (!current) return true;
    return current === label;
  });

  if (toResolve.length === 0) {
    console.log('[resolve] No brands need Gemini resolution.');
    return;
  }

  console.log(`[resolve] Gemini + Google Search for ${toResolve.length} brands…`);

  for (const label of toResolve) {
    const brand = brands.find((b) => b.label === label);
    const category = brand?.category ?? 'unknown';
    const attempted = corrections[label] ?? label;

    const resolved = await resolveFacebookPageNameWithSearch({
      brandLabel: label,
      category,
      attemptedName: attempted,
      scrapeError: 'No pageId found for company',
    });
    usages.push(resolved.usage);

    console.log(
      `[gemini] ${label} → ${resolved.metaPageName ?? '(null)'} (${resolved.confidence}) ${resolved.notes.slice(0, 80)}`
    );

    const candidates = new Set<string>();
    for (const c of [resolved.metaPageName, ...(resolved.alternateNames ?? [])]) {
      if (c?.trim()) candidates.add(c.trim());
    }

    let saved = false;
    for (const candidate of candidates) {
      if (!candidate || candidate === label) continue;
      const verify = await probeCompanyPage(candidate);
      scrapeCredits += 1;
      console.log(`  [verify] "${candidate}" → ${verify.status} (${verify.adCount} ads)`);
      if (verify.status === 'ok' || verify.status === 'zero_ads') {
        corrections[label] = candidate;
        saved = true;
        break;
      }
    }
    if (!saved && resolved.metaPageName) {
      console.log(`  [skip] No working page name for "${label}"`);
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  writeCorrections(corrections);

  const totalUsage = mergeStep2Usage(usages);
  const geminiCost = costFromUsage(totalUsage);
  console.log('\n--- Summary ---');
  console.log(`Corrections saved: ${Object.keys(corrections).length} entries`);
  console.log(`ScrapeCreators probe credits used this run: ~${scrapeCredits}`);
  if (geminiCost) {
    console.log(`Gemini est. cost: ${geminiCost.totalCostFormatted}`);
  }
  console.log('\nNext: npm run reingest-corrected-brands');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
