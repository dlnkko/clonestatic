import raw from './brand-page-corrections.json';

type CorrectionsFile = {
  corrections?: Record<string, string>;
};

function correctionsMap(): Record<string, string> {
  return (raw as CorrectionsFile).corrections ?? {};
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
