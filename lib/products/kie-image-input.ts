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

function roleFromKind(kind: ProductImage['kind']): string {
  if (kind === 'logo') return 'logo';
  if (kind === 'packaging') return 'packaging';
  if (kind === 'trust_badge') return 'trust_badge';
  return 'product';
}

/**
 * URLs sent to Kie image_input / input_urls — catalog only, never the reference ad.
 * Manual uploads: full catalog (logo first). Scraped: agent-matched set + logo if missing.
 */
export function buildKieProductImageUrls(params: {
  matchedVisuals: { role: string; url: string }[];
  catalogImages: ProductImage[];
  useFullCatalog?: boolean;
  maxUrls?: number;
}): string[] {
  const max = params.maxUrls ?? 16;
  const catalog = params.catalogImages.filter((i) => i.url.startsWith('http'));

  if (params.useFullCatalog && catalog.length > 0) {
    const visuals = orderMatchedVisualsForGeneration(
      catalog.map((img) => ({
        role: roleFromKind(img.kind),
        url: img.url,
        description: '',
      }))
    );
    return dedupeHttpUrls(visuals.map((v) => v.url)).slice(0, max);
  }

  let visuals = orderMatchedVisualsForGeneration(
    params.matchedVisuals
      .filter((m) => m.url.startsWith('http'))
      .map((m) => ({ role: m.role, url: m.url, description: '' }))
  );

  const catalogLogo = catalog.find((i) => i.kind === 'logo');
  if (catalogLogo && !visuals.some((v) => v.url === catalogLogo.url)) {
    visuals = [{ role: 'logo', url: catalogLogo.url, description: '' }, ...visuals];
  }

  return dedupeHttpUrls(visuals.map((v) => v.url)).slice(0, max);
}
