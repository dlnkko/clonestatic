/**
 * Re-ingest only brands with entries in brand-page-corrections.json
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

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
  const path = resolve(process.cwd(), 'lib/static-library/brand-page-corrections.json');
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { corrections?: Record<string, string> };
  const corrections = raw.corrections ?? {};
  const labels = Object.keys(corrections);

  if (labels.length === 0) {
    console.log('No corrections in brand-page-corrections.json. Run: npm run resolve-brand-names');
    process.exit(0);
  }

  console.log(`[reingest] ${labels.length} corrected brands:`, labels.join(', '));

  const { runStaticLibraryIngest } = await import('../lib/static-library/ingest');
  const result = await runStaticLibraryIngest({
    mode: 'brand_bootstrap',
    canonicalBrandLabels: labels,
    maxCredits: 800,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'completed' ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
