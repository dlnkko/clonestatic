/**
 * Resolve Meta page names for top skincare brands (Gemini + Google Search + probe).
 *
 *   npx tsx scripts/resolve-skincare-brands.ts
 *   npx tsx scripts/resolve-skincare-brands.ts --probe
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { SKINCARE_TOP_BRANDS } from '../lib/static-library/seeds-skincare-top';
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

async function main() {
  const probe = process.argv.includes('--probe');
  const corrections = readCorrections();
  let updated = 0;
  let scrapeCredits = 0;

  console.log(`Resolving ${SKINCARE_TOP_BRANDS.length} skincare brands…\n`);

  for (const brand of SKINCARE_TOP_BRANDS) {
    const existing = corrections[brand];
    if (existing && !probe) {
      console.log(`[skip] ${brand} → already "${existing}"`);
      continue;
    }

    let pageName: string;
    try {
      const resolved = await resolveFacebookPageNameWithSearch({
        brandLabel: brand,
        category: 'beauty / skincare',
      });
      pageName = resolved.metaPageName?.trim() || brand;
      console.log(`[gemini] ${brand} → "${pageName}" (${resolved.confidence})`);
    } catch (err) {
      console.warn(`[gemini] ${brand} failed:`, err);
      continue;
    }

    if (probe) {
      const probeResult = await probeCompanyPage(pageName);
      scrapeCredits += 1;
      console.log(
        `  probe: ${probeResult.status} ads=${probeResult.adCount} sample="${probeResult.samplePageName ?? '—'}"`
      );
      if (probeResult.status === 'ok' && probeResult.samplePageName) {
        pageName = probeResult.samplePageName;
      }
      if (probeResult.status === 'page_id_not_found') {
        console.warn(`  ⚠ no pageId for "${pageName}" — not saving`);
        continue;
      }
    }

    corrections[brand] = pageName;
    updated += 1;
  }

  writeCorrections(corrections);
  console.log(`\nDone. Updated ${updated} corrections. Probe credits ~${scrapeCredits}.`);
  console.log('Next: npm run ingest-library:skincare');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
