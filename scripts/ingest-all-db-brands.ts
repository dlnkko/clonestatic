/**
 * Ingest company + brand-keyword ads for every seed brand (uses brand-page-corrections.json).
 *
 *   npm run ingest-all-brands
 *   INGEST_ALL_MAX_CREDITS=6000 npm run ingest-all-brands
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { listSeedBrandLabels } from '../lib/static-library/list-all-brands';

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

async function main() {
  const labels = listSeedBrandLabels();
  const maxCredits = Number(process.env.INGEST_ALL_MAX_CREDITS ?? 4500);

  console.log(`[ingest-all] ${labels.length} seed brands, maxCredits=${maxCredits}`);

  const { runStaticLibraryIngest } = await import('../lib/static-library/ingest');
  const result = await runStaticLibraryIngest({
    mode: 'brand_bootstrap',
    canonicalBrandLabels: labels,
    maxCredits,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'completed' ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
