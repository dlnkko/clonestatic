import { currencyHintFromUrl, formatProductPrice, normalizeProductCurrency } from './currencies';
import type { ExtractedPricing } from './types';

export type { ExtractedPricing };

type PriceHit = { value: number; raw: string; currency: string; source: string };

const CURRENCY_CODE_RE = /\b(USD|EUR|GBP|CAD|ARS|COP|CLP|MXN|PEN|BRL|JPY)\b/gi;

const PRICE_NUM = String.raw`(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)`;

const SYMBOL_PATTERNS: { currency: string; re: RegExp }[] = [
  { currency: 'BRL', re: new RegExp(String.raw`R\$\s*${PRICE_NUM}`, 'g') },
  { currency: 'PEN', re: new RegExp(String.raw`S\/\.?\s*${PRICE_NUM}`, 'g') },
  { currency: 'EUR', re: new RegExp(String.raw`€\s*${PRICE_NUM}|${PRICE_NUM}\s*€`, 'g') },
  { currency: 'GBP', re: new RegExp(String.raw`£\s*${PRICE_NUM}|${PRICE_NUM}\s*£`, 'g') },
  { currency: 'CAD', re: new RegExp(String.raw`C\$\s*${PRICE_NUM}`, 'g') },
  { currency: 'JPY', re: new RegExp(String.raw`¥\s*${PRICE_NUM}|${PRICE_NUM}\s*¥|${PRICE_NUM}\s*円`, 'g') },
  { currency: 'USD', re: new RegExp(String.raw`\$\s*${PRICE_NUM}`, 'g') },
  { currency: 'USD', re: new RegExp(String.raw`(?:USD|US\$)\s*${PRICE_NUM}`, 'gi') },
];

const GENERIC_PATTERNS = [
  new RegExp(String.raw`(?:price|precio|preço|valor)[:\s]*(?:[\$€£¥R]|S\/\.?)?\s*${PRICE_NUM}`, 'gi'),
  /"price"\s*:\s*"?([\d.]+)"?/gi,
  /data-price=["']([\d.]+)["']/gi,
  /(?:compare_at|compareAt)_?price["']?\s*:\s*(\d+)/gi,
  /itemprop=["']price["'][^>]*content=["']([\d.]+)["']/gi,
  /content=["']([\d.]+)["'][^>]*itemprop=["']price["']/gi,
];

const DISCOUNT_PATTERNS: { regular: RegExp; sale: RegExp }[] = [
  {
    regular: new RegExp(
      String.raw`(?:compare\s*at|was|originally|list\s*price|msrp|antes|de)\s*(?:[\$€£]|S\/\.?|R\$)?\s*${PRICE_NUM}`,
      'gi'
    ),
    sale: new RegExp(
      String.raw`(?:now|sale|today|ahora|por\s+solo|solo)\s*(?:[\$€£]|S\/\.?|R\$)?\s*${PRICE_NUM}`,
      'gi'
    ),
  },
];

function parseAmount(raw: string, context: string): number | null {
  let cleaned = raw.trim();
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  let n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  if (n >= 500 && /"price"|compare_at|regular_price|Shopify|variant/i.test(context)) {
    const asMajor = n / 100;
    if (asMajor >= 0.5 && asMajor < 100000) n = asMajor;
  }
  return n >= 0.01 && n < 10000000 ? n : null;
}

function detectCurrencyFromText(text: string, urlHint: string | null): string {
  const codes: string[] = [];
  CURRENCY_CODE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CURRENCY_CODE_RE.exec(text)) !== null) {
    codes.push(m[1].toUpperCase());
  }
  if (codes.length > 0) {
    return normalizeProductCurrency(codes[0]);
  }

  for (const { currency, re } of SYMBOL_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) return currency;
  }

  if (urlHint) return normalizeProductCurrency(urlHint);
  return 'USD';
}

function formatStoredPrice(value: number, currency: string): string {
  return formatProductPrice(String(value), currency) || `${currency} ${value}`;
}

function metaValue(metadata: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = metadata[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

function extractPricingFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  urlHint: string | null
): ExtractedPricing | null {
  if (!metadata) return null;

  const amountRaw =
    metaValue(
      metadata,
      'productPriceAmount',
      'ogPriceAmount',
      'product:price:amount',
      'og:price:amount',
      'price',
      'productPrice'
    ) ?? null;

  const currencyRaw =
    metaValue(
      metadata,
      'productPriceCurrency',
      'ogPriceCurrency',
      'product:price:currency',
      'og:price:currency',
      'priceCurrency'
    ) ?? urlHint;

  if (!amountRaw) return null;

  const value = parseAmount(amountRaw, amountRaw);
  if (value == null) return null;

  const currency = normalizeProductCurrency(currencyRaw ?? detectCurrencyFromText('', urlHint));
  const formatted = formatStoredPrice(value, currency);

  return {
    regularPrice: formatted,
    salePrice: formatted,
    currency,
    rawSnippets: [`metadata:${amountRaw} ${currencyRaw ?? ''}`.trim()],
  };
}

function parseJsonLdBlocks(text: string): unknown[] {
  const out: unknown[] = [];
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(text)) !== null) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      /* ignore malformed blocks */
    }
  }

  const mdRe = /```json\s*([\s\S]*?)```/gi;
  while ((m = mdRe.exec(text)) !== null) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      /* ignore */
    }
  }

  return out;
}

function isProductType(type: unknown): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => /Product/i.test(String(t)));
}

function collectOffersFromNode(
  node: unknown,
  hits: PriceHit[],
  currencyHint: string,
  depth = 0
): void {
  if (depth > 8 || node == null) return;

  if (Array.isArray(node)) {
    for (const item of node) collectOffersFromNode(item, hits, currencyHint, depth + 1);
    return;
  }

  if (typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;

  if (isProductType(obj['@type'])) {
    const offers = obj.offers ?? obj.Offer;
    collectOffersFromNode(offers, hits, currencyHint, depth + 1);

    const low = obj.lowPrice ?? obj.price;
    const high = obj.highPrice;
    if (typeof low === 'number' || typeof low === 'string') {
      const amt = parseAmount(String(low), JSON.stringify(obj));
      if (amt != null) {
        hits.push({
          value: amt,
          raw: `jsonld:price:${low}`,
          currency: currencyHint,
          source: 'jsonld',
        });
      }
    }
    if (typeof high === 'number' || typeof high === 'string') {
      const amt = parseAmount(String(high), JSON.stringify(obj));
      if (amt != null) {
        hits.push({
          value: amt,
          raw: `jsonld:highPrice:${high}`,
          currency: currencyHint,
          source: 'jsonld',
        });
      }
    }
  }

  const offerTypes = ['Offer', 'AggregateOffer'];
  const typeStr = String(obj['@type'] ?? '');
  if (offerTypes.some((t) => typeStr.includes(t))) {
    const price = obj.price ?? obj.lowPrice;
    const currency = normalizeProductCurrency(
      String(obj.priceCurrency ?? obj.currency ?? currencyHint)
    );
    if (typeof price === 'number' || typeof price === 'string') {
      const amt = parseAmount(String(price), JSON.stringify(obj));
      if (amt != null) {
        hits.push({
          value: amt,
          raw: `jsonld:offer:${price}`,
          currency,
          source: 'jsonld',
        });
      }
    }
    const high = obj.highPrice;
    if (typeof high === 'number' || typeof high === 'string') {
      const amt = parseAmount(String(high), JSON.stringify(obj));
      if (amt != null) {
        hits.push({
          value: amt,
          raw: `jsonld:high:${high}`,
          currency,
          source: 'jsonld',
        });
      }
    }
  }

  if (obj['@graph']) collectOffersFromNode(obj['@graph'], hits, currencyHint, depth + 1);
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') collectOffersFromNode(v, hits, currencyHint, depth + 1);
  }
}

function extractShopifyPrices(text: string, currencyHint: string): PriceHit[] {
  if (!/shopify|compare_at_price|compareAtPrice|\/products\//i.test(text)) return [];

  const hits: PriceHit[] = [];
  const patterns: { re: RegExp; kind: 'sale' | 'regular' }[] = [
    { re: /"compare_at_price"\s*:\s*(\d+)/g, kind: 'regular' },
    { re: /"compareAtPrice"\s*:\s*(\d+)/g, kind: 'regular' },
    { re: /compare_at_price["']?\s*:\s*(\d+)/g, kind: 'regular' },
    { re: /"price"\s*:\s*(\d{3,})/g, kind: 'sale' },
  ];

  for (const { re, kind } of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const ctx = text.slice(Math.max(0, m.index - 60), m.index + 60);
      const amt = parseAmount(m[1], ctx);
      if (amt != null) {
        hits.push({
          value: amt,
          raw: `shopify:${kind}:${m[1]}`,
          currency: currencyHint,
          source: kind === 'regular' ? 'shopify-compare' : 'shopify-price',
        });
      }
    }
  }

  return hits;
}

function hitsToPricing(hits: PriceHit[], currencyFallback: string): ExtractedPricing | null {
  if (hits.length === 0) return null;

  const currency = hits.find((h) => h.currency)?.currency ?? currencyFallback;
  const regularHits = hits.filter((h) => h.source.includes('compare') || h.source.includes('high'));
  const saleHits = hits.filter((h) => !h.source.includes('compare') && !h.source.includes('high'));

  const allValues = [...new Map(hits.map((h) => [`${h.currency}:${h.value}`, h])).values()].sort(
    (a, b) => b.value - a.value
  );

  let regular: number | null = null;
  let sale: number | null = null;

  if (regularHits.length > 0 && saleHits.length > 0) {
    regular = Math.max(...regularHits.map((h) => h.value));
    sale = Math.min(...saleHits.map((h) => h.value));
  } else if (allValues.length >= 2) {
    regular = allValues[0].value;
    sale = allValues[allValues.length - 1].value;
    if (regular === sale) sale = null;
  } else {
    sale = allValues[0].value;
  }

  const snippets = hits.map((h) => h.raw).slice(0, 8);

  return {
    regularPrice: regular != null ? formatStoredPrice(regular, currency) : null,
    salePrice:
      sale != null
        ? formatStoredPrice(sale, currency)
        : regular != null
          ? formatStoredPrice(regular, currency)
          : null,
    currency,
    rawSnippets: snippets,
  };
}

function extractPricingFromStructured(
  sources: { html?: string | null; markdown?: string | null; metadata?: Record<string, unknown> | null },
  options?: { productUrl?: string }
): ExtractedPricing | null {
  const urlHint = currencyHintFromUrl(options?.productUrl);
  const combined = [sources.html, sources.markdown].filter(Boolean).join('\n');
  if (!combined && !sources.metadata) return null;

  const currencyHint = detectCurrencyFromText(combined, urlHint);
  const hits: PriceHit[] = [];

  const fromMeta = extractPricingFromMetadata(sources.metadata ?? null, urlHint);
  if (fromMeta?.salePrice) {
    const amt = parseAmount(fromMeta.salePrice.replace(/[^\d.,]/g, ''), fromMeta.salePrice);
    if (amt != null) {
      hits.push({
        value: amt,
        raw: fromMeta.rawSnippets[0] ?? 'metadata',
        currency: fromMeta.currency,
        source: 'metadata',
      });
    }
  }

  for (const block of parseJsonLdBlocks(combined)) {
    collectOffersFromNode(block, hits, currencyHint);
  }

  hits.push(...extractShopifyPrices(combined, currencyHint));

  return hitsToPricing(hits, currencyHint);
}

export function extractPricingFromText(
  text: string,
  options?: { productUrl?: string }
): ExtractedPricing {
  const urlHint = currencyHintFromUrl(options?.productUrl);
  const currency = detectCurrencyFromText(text, urlHint);
  const amounts: PriceHit[] = [];
  const snippets: string[] = [];

  for (const { currency: symCurrency, re } of SYMBOL_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const rawNum = m[1];
      if (!rawNum) continue;
      const ctx = m[0] + text.slice(Math.max(0, m.index - 40), m.index + 40);
      const amt = parseAmount(rawNum, ctx);
      if (amt != null) {
        const raw = m[0].trim().slice(0, 80);
        amounts.push({ value: amt, raw, currency: symCurrency, source: 'text' });
        if (!snippets.includes(raw)) snippets.push(raw);
      }
    }
  }

  for (const re of GENERIC_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const ctx = m[0] + text.slice(Math.max(0, m.index - 40), m.index + 40);
      const isCompare = /compare_at|regular|compareAt/i.test(m[0]);
      const amt = parseAmount(m[1], ctx);
      if (amt != null) {
        const raw = m[0].trim().slice(0, 80);
        amounts.push({
          value: amt,
          raw,
          currency,
          source: isCompare ? 'text-compare' : 'text',
        });
        if (!snippets.includes(raw)) snippets.push(raw);
      }
    }
  }

  for (const { regular, sale } of DISCOUNT_PATTERNS) {
    regular.lastIndex = 0;
    sale.lastIndex = 0;
    const regMatch = regular.exec(text);
    const saleMatch = sale.exec(text);
    if (regMatch && saleMatch) {
      const reg = parseAmount(regMatch[1], text);
      const sl = parseAmount(saleMatch[1], text);
      if (reg != null && sl != null && reg > sl) {
        return {
          regularPrice: formatStoredPrice(reg, currency),
          salePrice: formatStoredPrice(sl, currency),
          currency,
          rawSnippets: [regMatch[0].slice(0, 80), saleMatch[0].slice(0, 80), ...snippets].slice(
            0,
            8
          ),
        };
      }
    }
  }

  if (/~~/.test(text)) {
    const strike = text.match(/~~(?:[\$€£]|S\/\.?)?\s*(\d+(?:\.\d{2})?)~~/);
    const current = text.match(/~~[\s\S]*?~~\s*(?:[\$€£]|S\/\.?)?\s*(\d+(?:\.\d{2})?)/);
    if (strike && current) {
      const reg = parseAmount(strike[1], text);
      const sl = parseAmount(current[1], text);
      if (reg != null && sl != null && reg > sl) {
        return {
          regularPrice: formatStoredPrice(reg, currency),
          salePrice: formatStoredPrice(sl, currency),
          currency,
          rawSnippets: [strike[0], current[0], ...snippets].slice(0, 8),
        };
      }
    }
  }

  const pricing = hitsToPricing(amounts, currency);
  if (pricing) {
    return { ...pricing, rawSnippets: [...new Set([...pricing.rawSnippets, ...snippets])].slice(0, 8) };
  }

  return {
    regularPrice: null,
    salePrice: null,
    currency,
    rawSnippets: snippets.slice(0, 8),
  };
}

function mergePricing(
  structured: ExtractedPricing | null,
  fromText: ExtractedPricing
): ExtractedPricing {
  if (!structured?.salePrice && !structured?.regularPrice) {
    return fromText;
  }
  if (!fromText.salePrice && !fromText.regularPrice) {
    return structured!;
  }

  const currency = structured!.currency || fromText.currency;
  const structuredSale = structured!.salePrice;
  const structuredRegular = structured!.regularPrice;
  const textSale = fromText.salePrice;
  const textRegular = fromText.regularPrice;

  const parseFmt = (s: string | null) => {
    if (!s) return null;
    return parseAmount(s.replace(/[^\d.,]/g, ''), s);
  };

  const saleCandidates = [parseFmt(structuredSale), parseFmt(textSale)].filter(
    (n): n is number => n != null
  );
  const regularCandidates = [parseFmt(structuredRegular), parseFmt(textRegular)].filter(
    (n): n is number => n != null
  );

  const sale = saleCandidates.length ? Math.min(...saleCandidates) : null;
  let regular = regularCandidates.length ? Math.max(...regularCandidates) : null;

  if (regular != null && sale != null && regular <= sale) {
    regular = null;
  }

  return {
    regularPrice: regular != null ? formatStoredPrice(regular, currency) : null,
    salePrice:
      sale != null
        ? formatStoredPrice(sale, currency)
        : regular != null
          ? formatStoredPrice(regular, currency)
          : null,
    currency,
    rawSnippets: [...new Set([...(structured!.rawSnippets ?? []), ...fromText.rawSnippets])].slice(
      0,
      8
    ),
  };
}

/** Full pricing extraction from all Firecrawl scrape outputs. */
export function extractProductPricing(input: {
  summary?: string | null;
  markdown?: string | null;
  html?: string | null;
  metadata?: Record<string, unknown> | null;
  productUrl?: string;
}): ExtractedPricing {
  const textBlob = [input.summary, input.markdown].filter(Boolean).join('\n');
  const structured = extractPricingFromStructured(
    { html: input.html, markdown: input.markdown, metadata: input.metadata },
    { productUrl: input.productUrl }
  );
  const fromText = extractPricingFromText(textBlob, { productUrl: input.productUrl });
  return mergePricing(structured, fromText);
}

/** Single price line allowed in generated ads, or null if none found. */
export function allowedPriceForAds(
  pricing: ExtractedPricing | null | undefined,
  userOverride: string | null | undefined
): string | null {
  const override = userOverride?.trim();
  if (override) return override;
  if (!pricing) return null;
  return pricing.salePrice ?? pricing.regularPrice ?? null;
}
