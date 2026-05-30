import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

type CorrectionsFile = {
  corrections?: Record<string, string>;
};

/** Read corrections from disk (ingest scripts pick up latest after resolve). */
function correctionsMap(): Record<string, string> {
  if (typeof process !== 'undefined' && process.cwd) {
    const path = join(process.cwd(), 'lib/static-library/brand-page-corrections.json');
    if (existsSync(path)) {
      try {
        const raw = JSON.parse(readFileSync(path, 'utf8')) as CorrectionsFile;
        return raw.corrections ?? {};
      } catch {
        // fall through
      }
    }
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require('./brand-page-corrections.json') as CorrectionsFile;
    return raw.corrections ?? {};
  } catch {
    return {};
  }
}

/** Meta Ad Library page name for ScrapeCreators `companyName`. */
export function metaPageNameForBrand(canonicalLabel: string): string {
  const corrections = correctionsMap();
  const key = canonicalLabel.trim();
  if (corrections[key]) return corrections[key];
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(corrections)) {
    if (k.toLowerCase() === lower) return v;
  }
  return key;
}

export function listBrandPageCorrections(): Record<string, string> {
  return { ...correctionsMap() };
}
