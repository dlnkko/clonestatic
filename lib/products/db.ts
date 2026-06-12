import { allowedPriceForAds } from './extract-pricing';
import {
  buildAllowedPriceFromConfig,
  pricingInstructionsFromConfig,
} from './pricing-config';
import { normalizeStoredImageUrl } from './media-url';
import type { ProductImage, ProductRecord, ProductScrapeCache } from './types';

function sanitizeProductImages(images: ProductImage[]): ProductImage[] {
  return images
    .map((img) => ({
      ...img,
      url: normalizeStoredImageUrl(img.url),
    }))
    .filter((img) => img.url.startsWith('http'));
}

function sanitizePrimaryImageUrl(primary: unknown, images: ProductImage[]): string {
  const raw = normalizeStoredImageUrl(typeof primary === 'string' ? primary : '');
  if (raw.startsWith('http')) return raw;
  const fromCatalog =
    images.find((i) => i.kind !== 'logo')?.url ?? images.find((i) => i.url)?.url ?? '';
  return fromCatalog || raw;
}

export function getProductAllowedPrice(product: ProductRecord): string | null {
  const fromConfig = buildAllowedPriceFromConfig(product.scrape_cache?.pricingConfig);
  if (fromConfig) return fromConfig;
  return allowedPriceForAds(
    product.scrape_cache?.extractedPricing,
    product.scrape_cache?.priceDisplay
  );
}

export function getProductPricingInstructions(product: ProductRecord): string | null {
  const fromConfig = pricingInstructionsFromConfig(product.scrape_cache?.pricingConfig);
  if (fromConfig) return fromConfig;
  const allowed = getProductAllowedPrice(product);
  return allowed;
}

export function rowToProduct(row: Record<string, unknown>): ProductRecord {
  const images = sanitizeProductImages(
    Array.isArray(row.images) ? (row.images as ProductImage[]) : []
  );
  const logoRaw = normalizeStoredImageUrl((row.logo_url as string) || '');
  const logo_url = logoRaw.startsWith('http') ? logoRaw : null;

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    source: row.source as 'url' | 'manual',
    product_url: (row.product_url as string) || null,
    description: (row.description as string) || null,
    target_audience: (row.target_audience as string) || null,
    color_palette: (row.color_palette as ProductRecord['color_palette']) || null,
    logo_url,
    primary_image_url: sanitizePrimaryImageUrl(row.primary_image_url, images),
    images,
    scrape_cache: (row.scrape_cache as ProductScrapeCache) || null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function productCopywritingPayload(product: ProductRecord): string {
  if (product.scrape_cache) {
    return JSON.stringify({
      summary: product.scrape_cache.summary,
      branding: product.scrape_cache.branding,
      markdown: product.scrape_cache.markdown,
      productName: product.name,
      description: product.description,
      targetAudience: product.target_audience,
      colorPalette: product.color_palette,
      allowedPrice: getProductAllowedPrice(product),
      pricingConfig: product.scrape_cache.pricingConfig ?? null,
      extractedPricing: product.scrape_cache.extractedPricing ?? null,
    });
  }
  const parts = [
    `Product: ${product.name}`,
    product.description ? `Description: ${product.description}` : '',
    product.target_audience ? `Target audience: ${product.target_audience}` : '',
    product.color_palette?.colors?.length
      ? `Brand colors: ${product.color_palette.colors.join(', ')}`
      : '',
  ].filter(Boolean);
  return parts.join('\n');
}
