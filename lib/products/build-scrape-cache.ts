import { pricingConfigFromExtracted } from '@/lib/products/pricing-config';
import type { ProductScrapeCache } from '@/lib/products/types';

export const SCRAPE_MARKDOWN_MAX_CHARS = 12000;

export function truncateMarkdownForCache(markdown: string | null | undefined): string | null {
  if (!markdown?.trim()) return null;
  const trimmed = markdown.trim();
  if (trimmed.length <= SCRAPE_MARKDOWN_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, SCRAPE_MARKDOWN_MAX_CHARS)}\n\n[...truncated]`;
}

type PageScrapeSlice = {
  summary: string;
  branding: Record<string, unknown> | null;
  markdown: string | null;
  extractedPricing: ProductScrapeCache['extractedPricing'];
};

export function buildScrapeCacheFromPageScrape(
  scraped: PageScrapeSlice,
  productUrl: string,
  existing?: ProductScrapeCache | null
): ProductScrapeCache {
  const extractedPricing = scraped.extractedPricing;
  const autoPricing = pricingConfigFromExtracted(extractedPricing);

  return {
    summary: scraped.summary,
    branding: scraped.branding,
    markdown: truncateMarkdownForCache(scraped.markdown),
    scrapedAt: new Date().toISOString(),
    productUrl: productUrl.trim(),
    extractedPricing,
    priceDisplay:
      existing?.priceDisplay ??
      extractedPricing?.salePrice ??
      extractedPricing?.regularPrice ??
      null,
    pricingConfig: existing?.pricingConfig ?? autoPricing,
  };
}
