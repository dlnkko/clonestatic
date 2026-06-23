import { errorMessageFromUnknown } from '@/lib/api-error-message';
import getFirecrawlInstance from '@/lib/firecrawl';
import { classifyProductImagesHeuristic } from './classify-images';
import { filterCatalogProductImages, isUiChromeImage } from './filter-catalog-images';
import { extractProductPricing } from './extract-pricing';
import type { ExtractedPricing, ProductImage } from './types';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;
const LOGO_EXT = /\.(jpe?g|png|webp|gif|avif|svg)(\?|$)/i;
/** Skip UI chrome only — do NOT skip award/trust badge assets (often contain "badge" in URL). */
const SKIP_PATTERNS =
  /(favicon|sprite|logo-small|pixel|tracking|arrow|chevron|social|facebook|twitter|instagram|\/icons?\/|icon-\d+|star|rating|review-icon|trustpilot|payment|paypal|visa|mastercard)/i;

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

function isLikelyLogoUrl(url: string): boolean {
  if (!LOGO_EXT.test(url)) return false;
  if (/favicon|icon-16|icon-32|apple-touch|sprite|pixel|avatar|profile|gravatar/i.test(url)) {
    return false;
  }
  return /logo|brand-mark|wordmark|site-logo|header-logo|brand_logo|brand-logo/i.test(url);
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

function extractLogoUrlsFromHtml(html: string): string[] {
  const urls: string[] = [];
  const imgRe =
    /<img[^>]+(?:class|id|alt|data-srcset|src)=["'][^"']*logo[^"']*["'][^>]*>/gi;
  let tag: RegExpExecArray | null;
  while ((tag = imgRe.exec(html)) !== null) {
    const src = tag[0].match(/\bsrc=["'](https?:\/\/[^"']+)["']/i)?.[1];
    const dataSrc = tag[0].match(/\bdata-src=["'](https?:\/\/[^"']+)["']/i)?.[1];
    if (src) urls.push(src);
    if (dataSrc) urls.push(dataSrc);
  }
  return urls;
}

function readStringField(obj: unknown): string | null {
  return typeof obj === 'string' && obj.startsWith('http') ? obj : null;
}

function extractLogoFromBranding(branding: Record<string, unknown> | null): string[] {
  if (!branding) return [];
  const out: string[] = [];
  const direct = [
    readStringField(branding.logo),
    readStringField(branding.logoUrl),
    readStringField(branding.logo_url),
    readStringField(branding.image),
  ];
  for (const u of direct) {
    if (u) out.push(u);
  }
  const images = branding.images;
  if (images && typeof images === 'object') {
    const imgObj = images as Record<string, unknown>;
    for (const key of ['logo', 'brand', 'wordmark']) {
      const u = readStringField(imgObj[key]);
      if (u) out.push(u);
    }
  }
  return out;
}

function extractLogoFromMetadata(metadata: Record<string, unknown> | null): string[] {
  if (!metadata) return [];
  const out: string[] = [];
  const directLogo = readStringField(metadata.logo);
  if (directLogo) out.push(directLogo);
  for (const key of ['ogLogo', 'ogSiteLogo', 'siteLogo']) {
    const u = readStringField(metadata[key]);
    if (u) out.push(u);
  }
  for (const key of ['twitterImage', 'appleTouchIcon', 'favicon']) {
    const u = readStringField(metadata[key]);
    if (u && (LOGO_EXT.test(u) || isLikelyLogoUrl(u) || /logo|brand|wordmark/i.test(u))) {
      out.push(u);
    }
  }
  return out;
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

function orderProductImages(images: ProductImage[]): ProductImage[] {
  const classified = classifyProductImagesHeuristic(images);
  return filterCatalogProductImages(classified, 10);
}

/** Broader list for user image picker — keeps logos + product shots, drops UI chrome only. */
function orderBroadPreviewImages(images: ProductImage[], max: number): ProductImage[] {
  const classified = classifyProductImagesHeuristic(
    images.filter((img) => !isUiChromeImage(img.url, img.alt || ''))
  );
  const deduped: ProductImage[] = [];
  const seen = new Set<string>();
  const sorted = [...classified].sort((a, b) => {
    const rank = (img: ProductImage) => {
      if (img.kind === 'logo') return 0;
      if (img.kind === 'packaging') return 1;
      if (img.kind === 'product') return 2;
      if (img.kind === 'trust_badge') return 3;
      return 4;
    };
    return rank(a) - rank(b);
  });
  for (const img of sorted) {
    const key = img.url.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(img);
    if (deduped.length >= max) break;
  }
  return deduped;
}

export type ProductPageScrapeResult = {
  summary: string;
  branding: Record<string, unknown> | null;
  markdown: string | null;
  metadata: Record<string, unknown> | null;
  images: ProductImage[];
  logoUrl: string | null;
  extractedPricing: ExtractedPricing;
};

export type ScrapeProductPageOptions = {
  /** Skip collecting/downloading page images (copy/branding/pricing only). */
  skipImages?: boolean;
  /** Return a broader image list for user picker (less aggressive filtering). */
  broadImagePick?: boolean;
  /** Max images when broadImagePick is true (default 36). */
  imageLimit?: number;
};

export async function scrapeProductPage(
  url: string,
  options?: ScrapeProductPageOptions
): Promise<ProductPageScrapeResult> {
  const skipImages = options?.skipImages === true;
  const broadImagePick = options?.broadImagePick === true;
  const imageLimit = options?.imageLimit ?? (broadImagePick ? 36 : 10);
  const firecrawl = getFirecrawlInstance();
  const fc = firecrawl as {
    scrape?: (u: string, o: object) => Promise<unknown>;
    scrapeUrl?: (u: string, o: object) => Promise<unknown>;
  };
  const formats = skipImages
    ? { formats: ['summary', 'branding', 'markdown'] }
    : { formats: ['summary', 'branding', 'markdown', 'links', 'html'] };
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
      try {
        doc = (await fc.scrapeUrl(url, formats)) as Record<string, unknown>;
      } catch (secondErr) {
        throw new Error(
          errorMessageFromUnknown(secondErr, errorMessageFromUnknown(firstErr, 'Firecrawl request failed'))
        );
      }
    } else {
      throw new Error(errorMessageFromUnknown(firstErr, 'Firecrawl request failed'));
    }
  }

  if (doc && 'error' in doc && doc.error != null) {
    throw new Error(errorMessageFromUnknown(doc.error, 'Firecrawl scrape failed'));
  }

  if (doc && doc.success === false) {
    throw new Error(errorMessageFromUnknown(doc.error ?? doc, 'Firecrawl scrape failed'));
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
  const html = (data.html as string) || (data.rawHtml as string) || null;
  const metadata = (data.metadata as Record<string, unknown>) || null;

  const markdownForPrompt = markdown
    ? markdown.length > 12000
      ? markdown.slice(0, 12000) + '\n\n[...truncated]'
      : markdown
    : null;

  const extractedPricing = extractProductPricing({
    summary,
    markdown: markdownForPrompt ?? markdown,
    html: skipImages ? null : html,
    metadata,
    productUrl: url,
  });

  if (skipImages) {
    return {
      summary,
      branding,
      markdown: markdownForPrompt ?? markdown,
      metadata,
      images: [],
      logoUrl: null,
      extractedPricing,
    };
  }

  const productUrlSet = new Set<string>();
  const logoUrlSet = new Set<string>();

  if (markdown) {
    for (const u of extractUrlsFromMarkdown(markdown)) {
      if (isLikelyLogoUrl(u)) logoUrlSet.add(u);
      else if (isLikelyProductImage(u)) productUrlSet.add(u);
    }
  }
  if (html) {
    for (const u of extractLogoUrlsFromHtml(html)) {
      if (isLikelyLogoUrl(u) || LOGO_EXT.test(u)) logoUrlSet.add(u);
    }
    const htmlImg = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = htmlImg.exec(html)) !== null) {
      const u = m[1];
      if (isLikelyLogoUrl(u)) logoUrlSet.add(u);
      else if (isLikelyProductImage(u)) productUrlSet.add(u);
    }
  }

  const links = data.links as string[] | undefined;
  if (Array.isArray(links)) {
    for (const link of links) {
      if (typeof link !== 'string') continue;
      if (isLikelyLogoUrl(link)) logoUrlSet.add(link);
      else if (isLikelyProductImage(link)) productUrlSet.add(link);
    }
  }

  collectFromUnknown(branding, productUrlSet);
  collectFromUnknown(metadata, productUrlSet);
  collectFromUnknown(data, productUrlSet);

  for (const u of extractLogoFromBranding(branding)) {
    logoUrlSet.add(u);
  }
  for (const u of extractLogoFromMetadata(metadata)) {
    logoUrlSet.add(u);
  }

  const og = metadata?.ogImage ?? metadata?.image;
  if (typeof og === 'string' && isLikelyProductImage(og)) productUrlSet.add(og);

  for (const logoUrl of logoUrlSet) {
    productUrlSet.delete(logoUrl);
  }

  const rawImages: ProductImage[] = [
    ...[...productUrlSet].map((imageUrl, i) => ({
      url: imageUrl,
      kind: i === 0 ? ('product' as const) : ('other' as const),
      alt: `Product page image ${i + 1}`,
    })),
    ...[...logoUrlSet].map((imageUrl, i) => ({
      url: imageUrl,
      kind: 'logo' as const,
      alt: `Brand logo ${i + 1}`,
    })),
  ];

  const images = broadImagePick
    ? orderBroadPreviewImages(rawImages, imageLimit)
    : orderProductImages(rawImages);
  const logoUrl = images.find((i) => i.kind === 'logo')?.url ?? [...logoUrlSet][0] ?? null;

  return {
    summary,
    branding,
    markdown: markdownForPrompt ?? markdown,
    metadata,
    images,
    logoUrl,
    extractedPricing,
  };
}
