import { currencyHintFromUrl, formatProductPrice, normalizeProductCurrency, parsePriceNumeric } from './currencies';
import { createTierId, formatTierUnitPrice } from './pricing-config';
import type { ExtractedPricing, PricingTier } from './types';

export type { ExtractedPricing };

type PriceHit = { value: number; raw: string; currency: string; source: string; score: number };

const CURRENCY_CODE_RE = /\b(USD|EUR|GBP|CAD|ARS|COP|CLP|MXN|PEN|BRL|JPY)\b/gi;

const PRICE_NUM = String.raw`(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)`;

const UNIT_EACH_PATTERNS: RegExp[] = [
  new RegExp(String.raw`\$\s*${PRICE_NUM}\s*/\s*each`, 'gi'),
  new RegExp(String.raw`\$\s*${PRICE_NUM}\s*/\s*(?:bar|unit|piece|item|pc|ea)\b`, 'gi'),
  new RegExp(String.raw`${PRICE_NUM}\s*(?:USD|EUR|GBP|CAD)?\s*/\s*each`, 'gi'),
  new RegExp(String.raw`(?:each|per)\s*(?:[\$€£]|USD)?\s*${PRICE_NUM}`, 'gi'),
];

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
  if (n >= 100 && n < 10000000 && /"price"|compare_at|regular_price|Shopify|variant|cents/i.test(context)) {
    const asMajor = n / 100;
    if (asMajor >= 0.5 && asMajor < 100000) n = asMajor;
  }
  return n >= 0.01 && n < 10000000 ? n : null;
}

function scorePriceContext(raw: string, fullText: string, index: number): number {
  const window = fullText
    .slice(Math.max(0, index - 140), Math.min(fullText.length, index + raw.length + 140))
    .toLowerCase();
  let score = 0;

  if (/\/\s*each|per\s+(?:each|unit|bar|piece|item|pc)\b/i.test(raw)) score += 55;
  if (/most popular|most-popular|bestseller|best\s+seller/i.test(window)) score += 48;
  if (/best value|best-value/i.test(window)) score += 38;
  if (/selected|active|current|default|aria-selected/i.test(window)) score += 32;
  if (/\b1\s*bar|\b1\s*unit|\bsingle\b|\bone\b/i.test(window)) score += 28;
  if (/step\s*1|select quantity|choose quantity/i.test(window)) score += 18;
  if (/compare|was|originally|msrp|strike|~~|line-through|regular\s*price/i.test(window)) score -= 45;
  if (
    /shipping|delivery|save\s+\d+\s*%|free\s+shipping|orders?\s+over|off\s+orders|subscribe\s*&\s*save/i.test(
      window
    )
  )
    score -= 55;
  if (/subscription|monthly|per\s+month|\/mo\b|every\s+\d+\s+days/i.test(window)) score -= 40;

  return score;
}

function withScore(
  hit: Omit<PriceHit, 'score'>,
  text: string,
  index = 0,
  sourceBonus = 0
): PriceHit {
  return {
    ...hit,
    score: scorePriceContext(hit.raw, text, index) + sourceBonus,
  };
}

function sourceBonus(source: string): number {
  if (source === 'jsonld') return 18;
  if (source.includes('jsonld-high')) return 8;
  if (source === 'metadata') return 6;
  if (source.includes('shopify-price')) return 22;
  if (source.includes('shopify-compare')) return 12;
  if (source.includes('unit')) return 12;
  if (source.includes('compare') || source.includes('regular')) return 10;
  return 0;
}

function filterOutlierPrices(hits: PriceHit[]): PriceHit[] {
  if (hits.length < 2) return hits;
  const values = hits.map((h) => h.value).sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)];
  if (!Number.isFinite(median) || median <= 0) return hits;
  return hits.filter((h) => h.value >= median * 0.45 && h.value <= median * 2.5);
}

function isQuantityTierCluster(values: number[]): boolean {
  if (values.length < 2) return false;
  const sorted = [...values].sort((a, b) => b - a);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];
  if (highest < 5 || lowest < 5) return false;
  if (highest / lowest > 2.5) return false;
  return true;
}

function pickBestSinglePrice(hits: PriceHit[]): PriceHit | null {
  const filtered = filterOutlierPrices(hits);
  if (filtered.length === 0) return null;

  const unitHits = filtered.filter((h) => h.source.includes('unit'));
  const pool = unitHits.length > 0 ? unitHits : filtered;

  const scored = [...pool].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (unitHits.length > 0 && a.score >= 40 && b.score >= 40) {
      return b.value - a.value;
    }
    return b.value - a.value;
  });

  return scored[0] ?? null;
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
  sourceText: string,
  depth = 0
): void {
  if (depth > 8 || node == null) return;

  if (Array.isArray(node)) {
    for (const item of node) collectOffersFromNode(item, hits, currencyHint, sourceText, depth + 1);
    return;
  }

  if (typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;

  if (isProductType(obj['@type'])) {
    const offers = obj.offers ?? obj.Offer;
    collectOffersFromNode(offers, hits, currencyHint, sourceText, depth + 1);

    const low = obj.lowPrice ?? obj.price;
    const high = obj.highPrice;
    if (typeof low === 'number' || typeof low === 'string') {
      const amt = parseAmount(String(low), JSON.stringify(obj));
      if (amt != null) {
        const raw = `jsonld:price:${low}`;
        hits.push(withScore({ value: amt, raw, currency: currencyHint, source: 'jsonld' }, sourceText, 0, sourceBonus('jsonld')));
      }
    }
    if (typeof high === 'number' || typeof high === 'string') {
      const amt = parseAmount(String(high), JSON.stringify(obj));
      if (amt != null) {
        const raw = `jsonld:highPrice:${high}`;
        hits.push(
          withScore(
            { value: amt, raw, currency: currencyHint, source: 'jsonld-high' },
            sourceText,
            0,
            sourceBonus('jsonld-high')
          )
        );
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
        const raw = `jsonld:offer:${price}`;
        hits.push(withScore({ value: amt, raw, currency, source: 'jsonld' }, sourceText, 0, sourceBonus('jsonld')));
      }
    }
    const high = obj.highPrice;
    if (typeof high === 'number' || typeof high === 'string') {
      const amt = parseAmount(String(high), JSON.stringify(obj));
      if (amt != null) {
        const raw = `jsonld:high:${high}`;
        hits.push(
          withScore(
            { value: amt, raw, currency, source: 'jsonld-high' },
            sourceText,
            0,
            sourceBonus('jsonld-high')
          )
        );
      }
    }
  }

  if (obj['@graph']) collectOffersFromNode(obj['@graph'], hits, currencyHint, sourceText, depth + 1);
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') collectOffersFromNode(v, hits, currencyHint, sourceText, depth + 1);
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
        const source = kind === 'regular' ? 'shopify-compare' : 'shopify-price';
        const raw = `shopify:${kind}:${m[1]}`;
        hits.push(withScore({ value: amt, raw, currency: currencyHint, source }, text, m.index, sourceBonus(source)));
      }
    }
  }

  return hits;
}

function hitsToPricing(hits: PriceHit[], currencyFallback: string): ExtractedPricing | null {
  if (hits.length === 0) return null;

  const filtered = filterOutlierPrices(hits);
  if (filtered.length === 0) return null;

  const currency = filtered.find((h) => h.currency)?.currency ?? currencyFallback;
  const regularHits = filtered.filter(
    (h) => h.source.includes('compare') || h.source.includes('high') || h.source.includes('regular')
  );
  const explicitSaleHits = filtered.filter(
    (h) =>
      h.source.includes('sale') &&
      !h.source.includes('compare') &&
      !h.source.includes('high') &&
      !h.source.includes('regular')
  );

  let regular: number | null = null;
  let sale: number | null = null;

  if (regularHits.length > 0 && explicitSaleHits.length > 0) {
    regular = Math.max(...regularHits.map((h) => h.value));
    sale = Math.min(...explicitSaleHits.map((h) => h.value));
  } else {
    const uniqueValues = [...new Set(filtered.map((h) => h.value))];
    const tierLike = isQuantityTierCluster(uniqueValues);

    if (tierLike) {
      const best = pickBestSinglePrice(filtered);
      if (best) sale = best.value;
    } else if (uniqueValues.length >= 2 && regularHits.length > 0) {
      regular = Math.max(...regularHits.map((h) => h.value));
      sale = Math.min(...filtered.map((h) => h.value));
      if (regular === sale) regular = null;
    } else {
      const best = pickBestSinglePrice(filtered);
      if (best) sale = best.value;
    }
  }

  if (regular != null && sale != null && regular <= sale) {
    regular = null;
  }

  const snippets = filtered
    .sort((a, b) => b.score - a.score)
    .map((h) => h.raw)
    .slice(0, 8);

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
      const raw = fromMeta.rawSnippets[0] ?? 'metadata';
      hits.push(
        withScore(
          { value: amt, raw, currency: fromMeta.currency, source: 'metadata' },
          combined,
          0,
          sourceBonus('metadata')
        )
      );
    }
  }

  for (const block of parseJsonLdBlocks(combined)) {
    collectOffersFromNode(block, hits, currencyHint, combined);
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

  for (const re of UNIT_EACH_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const rawNum = m[1];
      if (!rawNum) continue;
      const ctx = m[0] + text.slice(Math.max(0, m.index - 40), m.index + 40);
      const amt = parseAmount(rawNum, ctx);
      if (amt != null) {
        const raw = m[0].trim().slice(0, 80);
        amounts.push(
          withScore(
            { value: amt, raw, currency, source: 'unit-each' },
            text,
            m.index,
            sourceBonus('unit-each')
          )
        );
        if (!snippets.includes(raw)) snippets.push(raw);
      }
    }
  }

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
        amounts.push(withScore({ value: amt, raw, currency: symCurrency, source: 'text' }, text, m.index));
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
      if (amt != null && amt >= 2) {
        const raw = m[0].trim().slice(0, 80);
        const source = isCompare ? 'text-compare' : 'text-json';
        amounts.push(
          withScore({ value: amt, raw, currency, source }, text, m.index, sourceBonus(source))
        );
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
  const textHasUnitPrices = fromText.rawSnippets.some((s) =>
    /\/\s*each|\/\s*bar|per\s+(?:unit|each)/i.test(s)
  );

  if (textHasUnitPrices && fromText.salePrice) {
    return {
      ...fromText,
      currency: fromText.currency || structured?.currency || 'USD',
      rawSnippets: [...new Set([...fromText.rawSnippets, ...(structured?.rawSnippets ?? [])])].slice(
        0,
        8
      ),
    };
  }

  if (!structured?.salePrice && !structured?.regularPrice) {
    return fromText;
  }
  if (!fromText.salePrice && !fromText.regularPrice) {
    return structured!;
  }

  const currency = structured!.currency || fromText.currency;
  const hits: PriceHit[] = [];

  const pushFormatted = (
    formatted: string | null,
    source: string,
    rawHint: string,
    bonus: number
  ) => {
    if (!formatted) return;
    const amt = parseAmount(formatted.replace(/[^\d.,]/g, ''), formatted);
    if (amt == null) return;
    hits.push(withScore({ value: amt, raw: rawHint || formatted, currency, source }, rawHint || formatted, 0, bonus));
  };

  pushFormatted(structured!.regularPrice, 'structured-regular', structured!.rawSnippets[0] ?? '', 14);
  pushFormatted(structured!.salePrice, 'structured', structured!.rawSnippets[0] ?? '', 10);
  pushFormatted(fromText.regularPrice, 'text-regular', fromText.rawSnippets[0] ?? '', 16);
  pushFormatted(fromText.salePrice, 'text', fromText.rawSnippets[0] ?? '', 18);

  const merged = hitsToPricing(hits, currency);
  if (merged) return merged;

  return fromText.salePrice ? fromText : structured!;
}

const QTY_LABEL_RE =
  /(\d+\+?\s*(?:bars?|units?|items?|packs?|pcs?|pieces?|bottles?|boxes?|sets?|bags?|rolls?|pairs?))/i;

function extractPricingTiers(text: string, currency: string): PricingTier[] {
  const unitEachRe = new RegExp(String.raw`\$\s*${PRICE_NUM}\s*/\s*each`, 'gi');
  const hits: { label: string; amount: number; context: string; index: number }[] = [];

  let m: RegExpExecArray | null;
  while ((m = unitEachRe.exec(text)) !== null) {
    const amt = parseAmount(m[1], m[0]);
    if (amt == null || amt < 1) continue;

    const start = Math.max(0, m.index - 180);
    const end = Math.min(text.length, m.index + m[0].length + 180);
    const context = text.slice(start, end);
    const labelMatch = context.match(QTY_LABEL_RE);
    const label = labelMatch ? labelMatch[1].trim() : `Option ${hits.length + 1}`;

    hits.push({ label, amount: amt, context, index: m.index });
  }

  if (hits.length < 2) return [];

  const tiers: PricingTier[] = [];
  const seen = new Set<string>();

  for (const h of hits) {
    const key = `${h.label.toLowerCase()}:${h.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const save = h.context.match(/save\s+(\d{1,2})\s*%/i);
    const badgeMatch = h.context.match(/(most popular|best value|best seller)/i);

    tiers.push({
      id: createTierId(),
      label: h.label,
      unitPrice: formatTierUnitPrice(String(h.amount), currency),
      discountPercent: save ? Number(save[1]) : null,
      badge: badgeMatch ? badgeMatch[1] : null,
      isDefault: false,
    });
  }

  tiers.sort(
    (a, b) =>
      Number(parsePriceNumeric(b.unitPrice) || 0) - Number(parsePriceNumeric(a.unitPrice) || 0)
  );

  const popularIdx = tiers.findIndex((t) => /most popular/i.test(t.badge || ''));
  const bestIdx = tiers.findIndex((t) => /best value/i.test(t.badge || ''));
  const defaultIdx = popularIdx >= 0 ? popularIdx : bestIdx >= 0 ? bestIdx : 0;
  tiers.forEach((t, i) => {
    t.isDefault = i === defaultIdx;
  });

  return tiers;
}

/** Full pricing extraction from all Firecrawl scrape outputs. */
export function extractProductPricing(input: {
  summary?: string | null;
  markdown?: string | null;
  html?: string | null;
  metadata?: Record<string, unknown> | null;
  productUrl?: string;
}): ExtractedPricing {
  const htmlText = input.html
    ? input.html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : null;
  const textBlob = [input.summary, input.markdown, htmlText].filter(Boolean).join('\n');
  const structured = extractPricingFromStructured(
    { html: input.html, markdown: input.markdown, metadata: input.metadata },
    { productUrl: input.productUrl }
  );
  const fromText = extractPricingFromText(textBlob, { productUrl: input.productUrl });
  const merged = mergePricing(structured, fromText);
  const tiers = extractPricingTiers(textBlob, merged.currency);
  const hasDiscount =
    merged.regularPrice && merged.salePrice && merged.regularPrice !== merged.salePrice;

  return {
    ...merged,
    tiers: tiers.length >= 2 ? tiers : undefined,
    compareAtPrice: hasDiscount ? merged.regularPrice : null,
  };
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
