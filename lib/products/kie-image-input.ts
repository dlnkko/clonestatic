import { orderMatchedVisualsForGeneration } from './ensure-logo-match';
import type { ProductImage } from './types';

function dedupeHttpUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!u.startsWith('http')) continue;
    const key = u.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

/**
 * URLs sent to Kie image_input — agent-matched catalog images only, never the reference ad.
 */
export function buildKieProductImageUrls(params: {
  matchedVisuals: { role: string; url: string }[];
  catalogImages: ProductImage[];
  /** @deprecated Always uses matched visuals only */
  useFullCatalog?: boolean;
  maxUrls?: number;
}): string[] {
  const max = params.maxUrls ?? 16;

  let visuals = orderMatchedVisualsForGeneration(
    params.matchedVisuals
      .filter((m) => m.url.startsWith('http'))
      .map((m) => ({ role: m.role, url: m.url, description: '' }))
  );

  return dedupeHttpUrls(visuals.map((v) => v.url)).slice(0, max);
}
