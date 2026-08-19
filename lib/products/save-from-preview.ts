import { uploadBase64ToImgBB } from '@/lib/imgbb';
import { classifyProductImagesHeuristic } from './classify-images';
import { normalizeStoredImageUrl } from './media-url';
import { dbPrimaryImageUrl } from './placeholder-image';
import {
  safeJsonClone,
  slimBranding,
  type PreviewSaveInput,
} from './preview-payload';
import type { ProductImage, ProductScrapeCache } from './types';

export type { PreviewSaveInput } from './preview-payload';
export { isPreviewSaveBody } from './preview-payload';

function httpUrls(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .map((u) => normalizeStoredImageUrl(u))
    .filter((u) => u.startsWith('http'));
}

async function uploadBase64Safe(base64: string): Promise<string | null> {
  if (!base64) return null;
  try {
    return await uploadBase64ToImgBB(base64);
  } catch (err) {
    console.error('preview save imgbb upload failed', err);
    return null;
  }
}

/** Build a products-table row for URL preview save. Never rehosts remote URLs (avoids Vercel timeouts). */
export async function buildPreviewSaveRow(userId: string, b: PreviewSaveInput) {
  const productUrlList = httpUrls(b.selectedProductUrls).slice(0, 10);
  const logoUrlList = httpUrls(b.selectedLogoUrls).slice(0, 2);
  const base64Products = Array.isArray(b.imageBase64List) ? b.imageBase64List.filter(Boolean) : [];
  const base64Logos = Array.isArray(b.logoBase64List) ? b.logoBase64List.filter(Boolean) : [];

  if (productUrlList.length + base64Products.length > 10) {
    throw Object.assign(new Error('Maximum 10 product images'), { status: 400 });
  }

  const images: ProductImage[] = [];
  for (let i = 0; i < productUrlList.length; i++) {
    images.push({
      url: productUrlList[i],
      kind: i === 0 ? 'product' : 'packaging',
      alt: `${b.name.trim()} image ${i + 1}`,
    });
  }
  for (let i = 0; i < base64Products.length; i++) {
    const nonLogoCount = images.filter((img) => img.kind !== 'logo').length;
    if (nonLogoCount >= 10) break;
    const url = await uploadBase64Safe(base64Products[i]);
    if (!url) continue;
    images.push({
      url,
      kind: nonLogoCount === 0 ? 'product' : 'packaging',
      alt: `${b.name.trim()} image ${nonLogoCount + 1}`,
    });
  }

  const logoUrls: string[] = [...logoUrlList];
  for (const url of logoUrlList) {
    images.push({ url, kind: 'logo', alt: `${b.name.trim()} logo` });
  }
  for (const base64 of base64Logos.slice(0, 2)) {
    const url = await uploadBase64Safe(base64);
    if (!url) continue;
    logoUrls.push(url);
    images.push({ url, kind: 'logo', alt: `${b.name.trim()} logo` });
  }

  const classifiedImages = classifyProductImagesHeuristic(images);
  const primary = dbPrimaryImageUrl(classifiedImages);
  const colors = b.colorPalette
    ?.split(/[,;\n]+/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 8);

  const scrapeCache: ProductScrapeCache = {
    summary: (b.scrapeSummary || b.description || b.name).trim(),
    branding: slimBranding(b.branding ?? null),
    markdown: b.markdown?.trim() ? b.markdown.trim().slice(0, 12000) : null,
    scrapedAt: new Date().toISOString(),
    productUrl: b.productUrl.trim(),
    extractedPricing: b.extractedPricing,
    priceDisplay: b.priceDisplay?.trim() || b.pricingConfig?.priceDisplay?.trim() || null,
    pricingConfig: b.pricingConfig ?? undefined,
  };

  return {
    user_id: userId,
    name: b.name.trim().slice(0, 200),
    source: 'url' as const,
    product_url: b.productUrl.trim(),
    description: (b.description || '').trim().slice(0, 4000) || null,
    target_audience: b.targetAudience?.trim().slice(0, 1000) || null,
    color_palette: colors?.length ? { colors } : null,
    logo_url: logoUrls[0] ?? null,
    primary_image_url: primary,
    images: classifiedImages,
    scrape_cache: safeJsonClone(scrapeCache, {
      summary: b.name.trim(),
      branding: null,
      markdown: null,
      scrapedAt: new Date().toISOString(),
      productUrl: b.productUrl.trim(),
    }),
  };
}
