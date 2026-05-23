import type { ExtractedPricing } from './types';

export type { ExtractedPricing };

const PRICE_PATTERNS = [
  /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:USD|usd)?/g,
  /(?:USD|US\$)\s*([\d,]+(?:\.\d{2})?)/gi,
  /(?:price|precio)[:\s]*\$?\s*([\d,]+(?:\.\d{2})?)/gi,
  /"price"\s*:\s*"?([\d.]+)"?/gi,
  /data-price=["']([\d.]+)["']/gi,
  /(?:regular|compare_at|compareAt)_?price["']?\s*:\s*(\d+)/gi,
];

function normalizePriceValue(raw: string, context: string): number | null {
  let n = parseFloat(raw.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  // Shopify often stores cents in JSON (e.g. 12000 = $120)
  if (n >= 500 && /"price"|compare_at|regular_price|Shopify/i.test(context)) {
    const asDollars = n / 100;
    if (asDollars >= 1 && asDollars < 10000) n = asDollars;
  }
  return n >= 1 && n < 100000 ? n : null;
}

export function extractPricingFromText(text: string): ExtractedPricing {
  const amounts: { value: number; raw: string }[] = [];
  const snippets: string[] = [];

  for (const re of PRICE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const amt = normalizePriceValue(m[1], m[0] + text.slice(Math.max(0, m.index - 40), m.index + 40));
      if (amt != null) {
        const raw = m[0].trim().slice(0, 80);
        amounts.push({ value: amt, raw });
        if (!snippets.includes(raw)) snippets.push(raw);
      }
    }
  }

  amounts.sort((a, b) => b.value - a.value);
  const unique = [...new Map(amounts.map((a) => [a.value, a])).values()];

  let regularPrice: string | null = null;
  let salePrice: string | null = null;

  if (unique.length >= 2) {
    regularPrice = `$${unique[0].value}`;
    salePrice = `$${unique[unique.length - 1].value}`;
  } else if (unique.length === 1) {
    regularPrice = `$${unique[0].value}`;
  }

  const compareAt = text.match(/compare\s*at\s*\$?\s*([\d,]+(?:\.\d{2})?)/i);
  const now = text.match(/(?:now|sale|today)[:\s]*\$?\s*([\d,]+(?:\.\d{2})?)/i);
  if (compareAt && now) {
    const reg = normalizePriceValue(compareAt[1], text);
    const sale = normalizePriceValue(now[1], text);
    if (reg != null) regularPrice = `$${reg}`;
    if (sale != null) salePrice = `$${sale}`;
  }

  return {
    regularPrice,
    salePrice: salePrice ?? regularPrice,
    currency: 'USD',
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
