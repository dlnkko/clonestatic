import { currencyHintFromUrl, formatProductPrice, normalizeProductCurrency } from './currencies';
import type { ExtractedPricing } from './types';

export type { ExtractedPricing };

type PriceHit = { value: number; raw: string; currency: string };

const CURRENCY_CODE_RE = /\b(USD|EUR|GBP|CAD|ARS|COP|CLP|MXN|PEN|BRL|JPY)\b/gi;

const SYMBOL_PATTERNS: { currency: string; re: RegExp }[] = [
  { currency: 'BRL', re: /R\$\s*([\d.,]+)/g },
  { currency: 'PEN', re: /S\/\.?\s*([\d.,]+)/g },
  { currency: 'EUR', re: /€\s*([\d.,]+)|([\d.,]+)\s*€/g },
  { currency: 'GBP', re: /£\s*([\d.,]+)|([\d.,]+)\s*£/g },
  { currency: 'CAD', re: /C\$\s*([\d.,]+)/g },
  { currency: 'JPY', re: /¥\s*([\d.,]+)|([\d.,]+)\s*¥|([\d.,]+)\s*円/g },
  { currency: 'USD', re: /\$\s*([\d.,]+(?:\.\d{2})?)\s*(?:USD|usd)?/g },
  { currency: 'USD', re: /(?:USD|US\$)\s*([\d.,]+(?:\.\d{2})?)/gi },
];

const GENERIC_PATTERNS = [
  /(?:price|precio|preço)[:\s]*(?:[\$€£¥R]|S\/\.?)?\s*([\d.,]+(?:\.\d{2})?)/gi,
  /"price"\s*:\s*"?([\d.]+)"?/gi,
  /data-price=["']([\d.]+)["']/gi,
  /(?:regular|compare_at|compareAt)_?price["']?\s*:\s*(\d+)/gi,
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
    cleaned = cleaned.replace(',', '.');
  }

  let n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  if (n >= 500 && /"price"|compare_at|regular_price|Shopify/i.test(context)) {
    const asMajor = n / 100;
    if (asMajor >= 1 && asMajor < 100000) n = asMajor;
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
      const rawNum = m[1] ?? m[2] ?? m[3];
      if (!rawNum) continue;
      const ctx = m[0] + text.slice(Math.max(0, m.index - 40), m.index + 40);
      const amt = parseAmount(rawNum, ctx);
      if (amt != null) {
        const raw = m[0].trim().slice(0, 80);
        amounts.push({ value: amt, raw, currency: symCurrency });
        if (!snippets.includes(raw)) snippets.push(raw);
      }
    }
  }

  for (const re of GENERIC_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const amt = parseAmount(m[1], m[0] + text.slice(Math.max(0, m.index - 40), m.index + 40));
      if (amt != null) {
        const raw = m[0].trim().slice(0, 80);
        amounts.push({ value: amt, raw, currency });
        if (!snippets.includes(raw)) snippets.push(raw);
      }
    }
  }

  amounts.sort((a, b) => b.value - a.value);
  const unique = [...new Map(amounts.map((a) => [a.value, a])).values()];

  let regularPrice: string | null = null;
  let salePrice: string | null = null;
  const displayCurrency = unique[0]?.currency ?? currency;

  if (unique.length >= 2) {
    regularPrice = formatStoredPrice(unique[0].value, displayCurrency);
    salePrice = formatStoredPrice(unique[unique.length - 1].value, displayCurrency);
  } else if (unique.length === 1) {
    regularPrice = formatStoredPrice(unique[0].value, displayCurrency);
  }

  const compareAt = text.match(/compare\s*at\s*(?:[\$€£]|S\/\.?)?\s*([\d.,]+(?:\.\d{2})?)/i);
  const now = text.match(/(?:now|sale|today|ahora)[:\s]*(?:[\$€£]|S\/\.?)?\s*([\d.,]+(?:\.\d{2})?)/i);
  if (compareAt && now) {
    const reg = parseAmount(compareAt[1], text);
    const sale = parseAmount(now[1], text);
    if (reg != null) regularPrice = formatStoredPrice(reg, displayCurrency);
    if (sale != null) salePrice = formatStoredPrice(sale, displayCurrency);
  }

  return {
    regularPrice,
    salePrice: salePrice ?? regularPrice,
    currency: displayCurrency,
    rawSnippets: snippets.slice(0, 8),
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
