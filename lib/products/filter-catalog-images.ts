import { classifyProductImagesHeuristic } from './classify-images';
import type { ProductImage, ProductImageKind } from './types';

const UI_CHROME_URL =
  /(?:^|\/|\?|&)(?:star|rating|review|reviews|icon|icons|sprite|widget|emoji|arrow|chevron|payment|visa|mastercard|paypal|amex|shopify|trustpilot|klarna|afterpay|spinner|loader|placeholder|avatar|profile|gravatar|social|facebook|twitter|instagram|tiktok|youtube|pinterest|badge-empty|empty-star|half-star|full-star|outline-star)(?:[./_-]|$|[?&])/i;

const TINY_DIMENSION =
  /(?:[?&](?:width|w|height|h|size)=)(?:1[0-9]|[2-4][0-9])(?:[&]|$)|(?:[_-](?:16|20|24|32|40|48|64)(?:[x._-]|\.(?:png|webp|jpg)))/i;

const ALLOWED_CATALOG_KINDS: ProductImageKind[] = [
  'product',
  'packaging',
  'trust_badge',
];

/** Skip rating stars, payment icons, tiny UI assets — not product photos. */
export function isUiChromeImage(url: string, alt = ''): boolean {
  const hay = `${url} ${alt}`.toLowerCase();
  if (UI_CHROME_URL.test(hay)) return true;
  if (TINY_DIMENSION.test(url)) return true;
  if (/\.svg(?:\?|$)/i.test(url) && !/(product|pack|label|logo|soap|bar|bottle|box)/i.test(hay)) {
    return true;
  }
  if (/favicon|apple-touch|icon-\d|sprite|pixel|tracking/i.test(hay)) return true;
  return false;
}

function scoreImage(img: ProductImage): number {
  const hay = `${img.url} ${img.alt || ''}`.toLowerCase();
  let score = 0;
  if (img.kind === 'packaging') score += 30;
  if (img.kind === 'product') score += 25;
  if (img.kind === 'trust_badge') score += 20;
  if (/label|wrap|sleeve|carton|bar|soap|tallow|bottle|tube|jar|pouch|box|pack/i.test(hay)) score += 15;
  if (/lifestyle|model|hand|bathroom|spa|grass|foam|lather|scene|flatlay/i.test(hay)) score -= 8;
  if (img.kind === 'lifestyle') score -= 5;
  if (img.kind === 'other') score -= 3;
  if (isUiChromeImage(img.url, img.alt)) score -= 100;
  return score;
}

/**
 * Keep only catalog-worthy photos: product, packaging, trust badges.
 * Drops stars, icons, and excess lifestyle shots when better assets exist.
 */
export function filterCatalogProductImages(
  images: ProductImage[],
  max = 10
): ProductImage[] {
  const classified = classifyProductImagesHeuristic(
    images.filter((img) => !isUiChromeImage(img.url, img.alt || ''))
  );

  const packaging = classified.filter((i) => i.kind === 'packaging');
  const product = classified.filter((i) => i.kind === 'product');
  const trust = classified.filter((i) => i.kind === 'trust_badge');
  const lifestyle = classified.filter((i) => i.kind === 'lifestyle');
  const other = classified.filter((i) => i.kind === 'other' || i.kind === 'ingredient');

  let core = [...packaging, ...product, ...trust];

  if (packaging.length === 0) {
    const packagingCandidates = other.filter((img) =>
      /label|wrap|sleeve|carton|packaging|pack-shot|packshot|bar-soap|soap-bar/i.test(
        `${img.url} ${img.alt || ''}`
      )
    );
    core = [...packagingCandidates.map((i) => ({ ...i, kind: 'packaging' as const })), ...core];
  }

  if (core.filter((i) => i.kind === 'product' || i.kind === 'packaging').length < 2) {
    const supplemental = [...lifestyle, ...other]
      .sort((a, b) => scoreImage(b) - scoreImage(a))
      .slice(0, Math.max(0, max - core.length));
    core = [...core, ...supplemental];
  }

  const deduped: ProductImage[] = [];
  const seen = new Set<string>();
  for (const img of core.sort((a, b) => scoreImage(b) - scoreImage(a))) {
    const key = img.url.split('?')[0];
    if (seen.has(key)) continue;
    if (!ALLOWED_CATALOG_KINDS.includes(img.kind as ProductImageKind) && img.kind !== 'lifestyle' && img.kind !== 'other') {
      continue;
    }
    if (img.kind === 'lifestyle' || img.kind === 'other') {
      if (deduped.filter((d) => d.kind === 'product' || d.kind === 'packaging').length >= 2) {
        continue;
      }
    }
    seen.add(key);
    deduped.push(img);
    if (deduped.length >= max) break;
  }

  return deduped.length > 0 ? deduped : classified.filter((i) => !isUiChromeImage(i.url, i.alt)).slice(0, max);
}
