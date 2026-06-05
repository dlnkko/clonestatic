import { filterCatalogProductImages } from './filter-catalog-images';
import type { ProductImage, ProductRecord } from './types';

const USER_UPLOAD_HOST =
  /(?:^|\/\/)(?:i\.)?ibb\.co|(?:^|\/\/)imgbb\.com/i;

export function isUserUploadedImageUrl(url: string): boolean {
  return USER_UPLOAD_HOST.test(url);
}

/** Product photos were uploaded by the user (manual flow or URL preview + imgBB), not scraped from a store CDN. */
export function isUserUploadedProduct(
  product: Pick<ProductRecord, 'source' | 'images'>
): boolean {
  if (product.source === 'manual') return true;
  const shots = (product.images || []).filter((i) => i.kind !== 'logo');
  if (shots.length === 0) return false;
  return shots.every((i) => isUserUploadedImageUrl(i.url));
}

/** First non-logo image — safe primary for generation and DB. */
export function primaryProductImageUrl(images: ProductImage[]): string | undefined {
  return images.find((i) => i.kind !== 'logo')?.url ?? images[0]?.url;
}

/** User-uploaded product shots: first = product, additional = packaging variants for matching. */
export function normalizeUserProductImageKinds(images: ProductImage[]): ProductImage[] {
  let productIndex = 0;
  return images.map((img) => {
    if (img.kind === 'logo' || img.kind === 'trust_badge') return img;
    if (img.kind === 'product' || img.kind === 'packaging') {
      productIndex += 1;
      return img;
    }
    const kind = productIndex === 0 ? ('product' as const) : ('packaging' as const);
    productIndex += 1;
    return { ...img, kind };
  });
}

export function injectLogoIntoCatalog(
  images: ProductImage[],
  logoUrl: string | null | undefined,
  productName?: string
): ProductImage[] {
  if (!logoUrl?.startsWith('http')) return images;
  if (images.some((i) => i.url === logoUrl)) return images;
  return [
    ...images,
    { url: logoUrl, kind: 'logo', alt: `${productName ?? 'Product'} logo` },
  ];
}

/**
 * Keep all user-uploaded product photos (they chose them intentionally).
 * Logos and trust badges are preserved for reference matching.
 */
export function filterUserUploadedCatalogImages(
  images: ProductImage[],
  maxProductShots = 10
): ProductImage[] {
  const logos = images.filter((i) => i.kind === 'logo');
  const trust = images.filter((i) => i.kind === 'trust_badge');
  const normalized = normalizeUserProductImageKinds(
    images.filter((i) => i.kind !== 'logo' && i.kind !== 'trust_badge')
  );

  const deduped: ProductImage[] = [];
  const seen = new Set<string>();
  for (const img of normalized) {
    const key = img.url.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(img);
    if (deduped.length >= maxProductShots) break;
  }

  const logoDeduped: ProductImage[] = [];
  const logoSeen = new Set<string>();
  for (const img of logos) {
    const key = img.url.split('?')[0];
    if (logoSeen.has(key)) continue;
    logoSeen.add(key);
    logoDeduped.push(img);
    if (logoDeduped.length >= 2) break;
  }

  return [...deduped, ...trust.slice(0, 1), ...logoDeduped];
}

export function finalizeCatalogAfterClassification(
  images: ProductImage[],
  product: Pick<ProductRecord, 'logo_url' | 'name' | 'source' | 'images'> | null
): ProductImage[] {
  const withLogo = injectLogoIntoCatalog(images, product?.logo_url, product?.name);
  if (product && isUserUploadedProduct(product)) {
    return filterUserUploadedCatalogImages(withLogo, 10);
  }
  const logos = withLogo.filter((i) => i.kind === 'logo');
  const productShots = filterCatalogProductImages(
    withLogo.filter((i) => i.kind !== 'logo'),
    10
  );
  return [...productShots, ...logos.slice(0, 2)];
}

/** Build the image catalog used for Step 1 matching and Kie generation. */
export function prepareCatalogForGeneration(
  product: Pick<ProductRecord, 'images' | 'logo_url' | 'name' | 'source'>
): ProductImage[] {
  const base = injectLogoIntoCatalog(product.images || [], product.logo_url, product.name);
  if (isUserUploadedProduct(product)) {
    return filterUserUploadedCatalogImages(normalizeUserProductImageKinds(base), 10);
  }
  const logos = base.filter((i) => i.kind === 'logo');
  const productShots = filterCatalogProductImages(
    base.filter((i) => i.kind !== 'logo'),
    10
  );
  return [...productShots, ...logos.slice(0, 2)];
}
