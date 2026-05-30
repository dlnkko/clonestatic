/**
 * Probe + Gemini resolve Meta page names for ALL brands (seeds + page_name in DB).
 *
 *   npm run resolve-all-brands              # probe all, Gemini only on failures/zero ads
 *   npm run resolve-all-brands -- --gemini-all   # Gemini every brand (slow/costly)
 *   npm run resolve-all-brands -- --then-ingest  # run full brand ingest after resolve
 *   npm run resolve-all-brands -- --limit=20     # smoke test
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { costFromUsage, mergeStep2Usage } from '../lib/adaptation/cost';
import type { Step2Usage } from '../lib/adaptation/types';
import { listAllBrandTargets } from '../lib/static-library/list-all-brands';
import { metaPageNameForBrand } from '../lib/static-library/page-name-corrections';
import { probeCompanyPage } from '../lib/static-library/probe-company-page';
import { resolveFacebookPageNameWithSearch } from '../lib/static-library/resolve-page-name';
import { createAdminClient } from '../lib/supabase/admin';

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
const PROBE_CACHE_PATH = resolve(process.cwd(), '.cache/all-brands-probe-cache.json');

type ProbeCache = Record<
  string,
  { status: string; adCount: number; samplePageName: string | null; tried: string; at: string }
>;

function readCorrections(): Record<string, string> {
  const raw = JSON.parse(readFileSync(CORRECTIONS_PATH, 'utf8')) as {
    corrections?: Record<string, string>;
  };
  return { ...(raw.corrections ?? {}) };
}

function writeCorrections(corrections: Record<string, string>) {
  writeFileSync(
    CORRECTIONS_PATH,
    JSON.stringify({ _comment: 'seed label → Meta page name', corrections }, null, 2) + '\n',
    'utf8'
  );
}

function saveCorrection(corrections: Record<string, string>, label: string, value: string) {
  if (!value.trim() || value.trim() === label) return;
  corrections[label] = value.trim();
  writeCorrections(corrections);
}

async function resolveWithRetry(
  input: Parameters<typeof resolveFacebookPageNameWithSearch>[0],
  maxAttempts = 4
) {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await resolveFacebookPageNameWithSearch(input);
    } catch (err) {
      lastErr = err;
      const wait = 800 * 2 ** i;
      console.warn(`  [gemini] retry ${i + 1}/${maxAttempts} in ${wait}ms:`, err);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
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

function needsResolve(
  probe: { status: string; adCount: number },
  geminiAll: boolean
): boolean {
  if (geminiAll) return true;
  if (probe.status === 'page_id_not_found') return true;
  if (probe.status === 'zero_ads') return true;
  if (probe.status === 'api_error') return true;
  if (probe.status === 'ok' && probe.adCount < 3) return true;
  return false;
}

async function verifyAndSave(
  label: string,
  corrections: Record<string, string>,
  candidates: string[],
  scrapeCredits: { n: number }
): Promise<boolean> {
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    const c = candidate.trim();
    const verify = await probeCompanyPage(c);
    scrapeCredits.n += 1;
    console.log(`  [verify] "${c}" → ${verify.status} (${verify.adCount} ads)`);
    if (verify.status === 'ok' || verify.status === 'zero_ads') {
      if (c !== label) {
        corrections[label] = c;
      }
      writeCorrections(corrections);
      return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const geminiAll = args.includes('--gemini-all');
  const thenIngest = args.includes('--then-ingest');
  const skipProbe = args.includes('--skip-probe');
  const includeDbOrphans = args.includes('--include-db-orphans');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Math.max(1, parseInt(limitArg.slice('--limit='.length), 10) || 0) : 0;

  const admin = createAdminClient();
  let targets = await listAllBrandTargets(admin, { includeDbOrphans });
  if (limit > 0) targets = targets.slice(0, limit);

  console.log(`[resolve-all] ${targets.length} brands (seeds + DB page names)`);

  let corrections = readCorrections();
  let probeCache = readProbeCache();
  const scrapeCredits = { n: 0 };
  const usages: (Step2Usage | null)[] = [];
  let probed = 0;
  let resolved = 0;
  let skippedOk = 0;

  for (const { label, category, source } of targets) {
    const attempt = metaPageNameForBrand(label);
    let probe = { status: 'unknown', adCount: 0, samplePageName: null as string | null };

    if (!skipProbe) {
      const cached = probeCache[label];
      const cacheFresh =
        cached?.at && Date.now() - new Date(cached.at).getTime() < 7 * 86400000;
      if (cacheFresh && cached.tried === attempt) {
        probe = {
          status: cached.status,
          adCount: cached.adCount,
          samplePageName: cached.samplePageName,
        };
      } else {
        probe = await probeCompanyPage(attempt);
        scrapeCredits.n += 1;
        probed += 1;
        probeCache[label] = {
          status: probe.status,
          adCount: probe.adCount,
          samplePageName: probe.samplePageName,
          tried: attempt,
          at: new Date().toISOString(),
        };
        if (probed % 25 === 0) writeProbeCache(probeCache);
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    console.log(
      `[probe] ${source}\t${category}\t${label}\t→ ${probe.status} (${probe.adCount} ads) company="${attempt}"`
    );

    if (!needsResolve(probe, geminiAll)) {
      if (probe.samplePageName && probe.samplePageName !== label && probe.adCount > 0) {
        const sample = probe.samplePageName.trim();
        if (sample !== attempt && !corrections[label]) {
          saveCorrection(corrections, label, sample);
          console.log(`  [auto] saved sample page name: "${sample}"`);
        }
      }
      skippedOk += 1;
      continue;
    }

    try {
      const resolvedResult = await resolveWithRetry({
        brandLabel: label,
        category,
        attemptedName: attempt,
        scrapeError:
          probe.status === 'page_id_not_found'
            ? 'No pageId found for company'
            : probe.status === 'zero_ads'
              ? 'Zero ads returned'
              : undefined,
      });
      usages.push(resolvedResult.usage);

      console.log(
        `[gemini] ${label} → ${resolvedResult.metaPageName ?? '(null)'} (${resolvedResult.confidence})`
      );

      const candidates = new Set<string>();
      for (const c of [
        resolvedResult.metaPageName,
        ...(resolvedResult.alternateNames ?? []),
        probe.samplePageName,
      ]) {
        if (c?.trim()) candidates.add(c.trim());
      }

      const saved = await verifyAndSave(label, corrections, [...candidates], scrapeCredits);
      if (saved) resolved += 1;
      else console.log(`  [skip] Could not verify a working page for "${label}"`);
    } catch (err) {
      console.error(`  [gemini] failed for "${label}", continuing:`, err);
    }

    await new Promise((r) => setTimeout(r, 450));
  }

  writeProbeCache(probeCache);
  writeCorrections(corrections);

  const totalUsage = mergeStep2Usage(usages);
  const geminiCost = costFromUsage(totalUsage);

  console.log('\n--- Summary ---');
  console.log(`Brands checked: ${targets.length}`);
  console.log(`Probed this run: ${probed}`);
  console.log(`Skipped (OK): ${skippedOk}`);
  console.log(`Corrections updated: ${resolved}`);
  console.log(`Total corrections in file: ${Object.keys(corrections).length}`);
  console.log(`ScrapeCreators credits this run: ~${scrapeCredits.n}`);
  if (geminiCost) console.log(`Gemini est. cost: ${geminiCost.totalCostFormatted}`);

  if (thenIngest) {
    console.log('\n[resolve-all] Starting full brand ingest (new process)…');
    const { spawnSync } = await import('child_process');
    const r = spawnSync('npx', ['tsx', 'scripts/ingest-all-db-brands.ts'], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd(),
      env: process.env,
    });
    process.exit(r.status ?? 1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
