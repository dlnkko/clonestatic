/**
 * Ingest Meta ads for top skincare brands only (company + brand keyword seeds).
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { runStaticLibraryIngest } from '../lib/static-library/ingest';
import { SKINCARE_TOP_BRANDS } from '../lib/static-library/seeds-skincare-top';

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
  const result = await runStaticLibraryIngest({
    mode: 'brand_bootstrap',
    maxCredits: 450,
    canonicalBrandLabels: [...SKINCARE_TOP_BRANDS],
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
