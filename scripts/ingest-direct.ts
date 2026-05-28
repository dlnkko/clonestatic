/**
 * Run library ingest without HTTP (no route timeout). Loads .env.local via Next/dotenv pattern.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

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

loadEnvLocal();

async function main() {
  const arg = process.argv[2];
  const mode =
    arg === 'refresh'
      ? 'refresh'
      : arg === 'brand_refresh'
        ? 'brand_refresh'
        : arg === 'brand_bootstrap' || arg === 'brands'
          ? 'brand_bootstrap'
          : 'bootstrap';

  const { runStaticLibraryIngest } = await import('../lib/static-library/ingest');
  const { countSeedsByType } = await import('../lib/static-library/seeds-mvp');
  const counts = countSeedsByType();
  console.log(`[ingest-direct] mode=${mode} seeds=${JSON.stringify(counts)}`);
  const result = await runStaticLibraryIngest({ mode });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'completed' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
