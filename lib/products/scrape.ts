import getFirecrawlInstance from '@/lib/firecrawl';
import { extractPricingFromText } from './extract-pricing';
import type { ExtractedPricing, ProductImage } from './types';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;
/** Skip UI chrome only — do NOT skip award/trust badge assets (often contain "badge" in URL). */
const SKIP_PATTERNS =
  /(favicon|sprite|logo-small|pixel|tracking|arrow|chevron|social|facebook|twitter|instagram|\.svg$|\/icons?\/)/i;

function isLikelyProductImage(url: string): boolean {
  if (!IMAGE_EXT.test(url)) return false;
  if (SKIP_PATTERNS.test(url)) return false;
  try {
    const u = new URL(url);
    if (u.pathname.length < 4) return false;
  } catch {
    return false;
  }
  return true;
}

function extractUrlsFromMarkdown(markdown: string): string[] {
  const urls: string[] = [];
  const mdImg = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = mdImg.exec(markdown)) !== null) {
    urls.push(m[1].replace(/\\$/, ''));
  }
  const htmlImg = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi;
  while ((m = htmlImg.exec(markdown)) !== null) {
    urls.push(m[1]);
  }
  return urls;
}

function collectFromUnknown(obj: unknown, out: Set<string>, depth = 0): void {
  if (depth > 6 || obj == null) return;
  if (typeof obj === 'string' && obj.startsWith('http') && isLikelyProductImage(obj)) {
    out.add(obj);
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) collectFromUnknown(item, out, depth + 1);
    return;
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      collectFromUnknown(v, out, depth + 1);
    }
  }
}

export type ProductPageScrapeResult = {
  summary: string;
  branding: Record<string, unknown> | null;
  markdown: string | null;
  metadata: Record<string, unknown> | null;
  images: ProductImage[];
  extractedPricing: ExtractedPricing;
};

export async function scrapeProductPage(url: string): Promise<ProductPageScrapeResult> {
  const firecrawl = getFirecrawlInstance();
  const fc = firecrawl as {
    scrape?: (u: string, o: object) => Promise<unknown>;
    scrapeUrl?: (u: string, o: object) => Promise<unknown>;
  };
  const formats = { formats: ['summary', 'branding', 'markdown', 'links'] };
  let doc: Record<string, unknown>;
  try {
    if (fc.scrape) {
      doc = (await fc.scrape(url, formats)) as Record<string, unknown>;
    } else if (fc.scrapeUrl) {
      doc = (await fc.scrapeUrl(url, formats)) as Record<string, unknown>;
    } else {
      throw new Error('Firecrawl scrape not available');
    }
  } catch (firstErr) {
    if (fc.scrapeUrl && fc.scrape) {
      doc = (await fc.scrapeUrl(url, formats)) as Record<string, unknown>;
    } else {
      throw firstErr;
    }
  }

  if (doc && 'error' in doc) {
    throw new Error(String(doc.error));
  }

  const data = (doc.data ?? doc) as Record<string, unknown>;
  const summary =
    (data.summary as string) ||
    ((data.metadata as Record<string, unknown>)?.description as string) ||
    '';
  if (!summary) {
    throw new Error('No summary could be extracted from the product page');
  }

  const branding = (data.branding as Record<string, unknown>) || null;
  const markdown = (data.markdown as string) || null;
  const metadata = (data.metadata as Record<string, unknown>) || null;

  const markdownForPrompt = markdown
    ? markdown.length > 12000
      ? markdown.slice(0, 12000) + '\n\n[...truncated]'
      : markdown
    : null;

  const urlSet = new Set<string>();
  if (markdown) {
    for (const u of extractUrlsFromMarkdown(markdown)) {
      if (isLikelyProductImage(u)) urlSet.add(u);
    }
  }
  const links = data.links as string[] | undefined;
  if (Array.isArray(links)) {
    for (const link of links) {
      if (typeof link === 'string' && isLikelyProductImage(link)) urlSet.add(link);
    }
  }
  collectFromUnknown(branding, urlSet);
  collectFromUnknown(metadata, urlSet);
  collectFromUnknown(data, urlSet);

  const og = metadata?.ogImage ?? metadata?.image;
  if (typeof og === 'string' && isLikelyProductImage(og)) urlSet.add(og);

  const images: ProductImage[] = [...urlSet].slice(0, 24).map((imageUrl, i) => ({
    url: imageUrl,
    kind: i === 0 ? 'product' : 'other',
    alt: `Product page image ${i + 1}`,
  }));

  const pricingText = [summary, markdownForPrompt ?? markdown].filter(Boolean).join('\n');
  const extractedPricing = extractPricingFromText(pricingText);

  return {
    summary,
    branding,
    markdown: markdownForPrompt ?? markdown,
    metadata,
    images,
    extractedPricing,
  };
}
