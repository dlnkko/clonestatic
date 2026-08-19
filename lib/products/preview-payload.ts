import type { ProductScrapeCache } from './types';

const MAX_BRANDING_CHARS = 40_000;

export function slimBranding(
  branding: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!branding) return null;
  try {
    const json = JSON.stringify(branding);
    if (json.length <= MAX_BRANDING_CHARS) return JSON.parse(json) as Record<string, unknown>;
    if (branding.colors) return { colors: branding.colors };
    return null;
  } catch {
    return branding.colors ? { colors: branding.colors } : null;
  }
}

export function safeJsonClone<T>(value: T, fallback: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return fallback;
  }
}

export type PreviewSaveInput = {
  productUrl: string;
  name: string;
  description?: string;
  targetAudience?: string;
  colorPalette?: string;
  priceDisplay?: string;
  pricingConfig?: ProductScrapeCache['pricingConfig'];
  logoBase64List?: string[];
  imageBase64List?: string[];
  selectedLogoUrls?: string[];
  selectedProductUrls?: string[];
  branding?: Record<string, unknown> | null;
  extractedPricing?: ProductScrapeCache['extractedPricing'];
  markdown?: string | null;
  scrapeSummary?: string | null;
};

export function isPreviewSaveBody(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (b.source !== 'url') return false;
  if (b.saveFromPreview === true || b.saveFromPreview === 'true') return true;
  return Array.isArray(b.selectedProductUrls) || Array.isArray(b.selectedLogoUrls);
}
