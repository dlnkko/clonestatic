import type { ProductScrapeCache } from './types';

type ScrapeSlice = {
  summary: string;
  branding: Record<string, unknown> | null;
  markdown: string | null;
  extractedPricing: ProductScrapeCache['extractedPricing'];
};

function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return '';
  }
}

/** True when live page scrape differs from stored cache (copy, markdown, branding, pricing). */
export function scrapeCacheContentChanged(
  existing: ProductScrapeCache | null | undefined,
  scraped: ScrapeSlice
): boolean {
  if (!existing) return true;

  if (existing.summary.trim() !== scraped.summary.trim()) return true;
  if ((existing.markdown ?? '').trim() !== (scraped.markdown ?? '').trim()) return true;
  if (stableJson(existing.branding) !== stableJson(scraped.branding)) return true;
  if (stableJson(existing.extractedPricing) !== stableJson(scraped.extractedPricing)) return true;

  return false;
}

export function pageDescriptionFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string {
  if (!metadata) return '';
  const candidates = [
    metadata.description,
    metadata.ogDescription,
    metadata['og:description'],
    metadata.twitterDescription,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim().slice(0, 4000);
  }
  return '';
}
