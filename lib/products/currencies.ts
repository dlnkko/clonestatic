export type CurrencyOption = {
  code: string;
  symbol: string;
  label: string;
};

/** Curated currencies for product pricing (with display symbols). */
export const PRODUCT_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'CHF', symbol: 'CHF', label: 'Swiss Franc' },
  { code: 'NOK', symbol: 'kr', label: 'Norwegian Krone' },
  { code: 'SEK', symbol: 'kr', label: 'Swedish Krona' },
  { code: 'PLN', symbol: 'zł', label: 'Polish Zloty' },
  { code: 'CZK', symbol: 'Kč', label: 'Czech Koruna' },
  { code: 'TRY', symbol: '₺', label: 'Turkish Lira' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar' },
  { code: 'ARS', symbol: '$', label: 'Argentine Peso' },
  { code: 'COP', symbol: '$', label: 'Colombian Peso' },
  { code: 'CLP', symbol: '$', label: 'Chilean Peso' },
  { code: 'MXN', symbol: '$', label: 'Mexican Peso' },
  { code: 'PEN', symbol: 'S/', label: 'Peruvian Sol' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
];

const CODE_SET = new Set(PRODUCT_CURRENCIES.map((c) => c.code));

/** Regex alternation of all supported ISO codes (for scrape / text detection). */
export function productCurrencyCodePattern(): string {
  return PRODUCT_CURRENCIES.map((c) => c.code).join('|');
}

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'CLP', 'COP']);

export function supportedProductCurrencyCodes(): string[] {
  return PRODUCT_CURRENCIES.map((c) => c.code);
}

export function normalizeProductCurrency(code: string | null | undefined): string {
  const upper = (code ?? 'USD').trim().toUpperCase();
  return CODE_SET.has(upper) ? upper : 'USD';
}

export function currencySymbol(code: string): string {
  return PRODUCT_CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

export function formatProductPrice(
  amount: string,
  currency: string,
  locale = 'en-US'
): string {
  const n = Number(String(amount).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return '';
  const code = normalizeProductCurrency(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2,
    }).format(n);
  } catch {
    return `${currencySymbol(code)}${n}`;
  }
}

/** Allow free numeric typing (digits + one decimal separator). Does not format. */
export function sanitizePriceInput(raw: string): string {
  let s = raw.replace(/[^\d.,]/g, '');
  const firstSep = s.search(/[.,]/);
  if (firstSep !== -1) {
    const sep = s[firstSep];
    s = s.slice(0, firstSep + 1) + s.slice(firstSep + 1).replace(/[.,]/g, '');
    if (sep === ',') {
      s = s.replace(',', '.');
    }
  }
  return s;
}

/** Parse numeric amount from a formatted price string (e.g. "$59.99" → "59.99"). */
export function parsePriceNumeric(display: string | null | undefined): string {
  if (!display?.trim()) return '';
  let s = display.trim().replace(/[^\d.,]/g, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    const parts = s.split(',');
    s = parts.length === 2 && parts[1].length <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  return s;
}
export function currencyHintFromUrl(productUrl: string | undefined): string | null {
  if (!productUrl?.trim()) return null;
  try {
    const host = new URL(productUrl.trim()).hostname.toLowerCase();
    if (host.endsWith('.com.ar') || host.endsWith('.ar')) return 'ARS';
    if (host.endsWith('.com.co') || host.endsWith('.co')) return 'COP';
    if (host.endsWith('.cl')) return 'CLP';
    if (host.endsWith('.com.mx') || host.endsWith('.mx')) return 'MXN';
    if (host.endsWith('.pe')) return 'PEN';
    if (host.endsWith('.com.br') || host.endsWith('.br')) return 'BRL';
    if (host.endsWith('.ca')) return 'CAD';
    if (host.endsWith('.co.uk') || host.endsWith('.uk')) return 'GBP';
    if (host.endsWith('.ch')) return 'CHF';
    if (host.endsWith('.no')) return 'NOK';
    if (host.endsWith('.se')) return 'SEK';
    if (host.endsWith('.pl')) return 'PLN';
    if (host.endsWith('.cz')) return 'CZK';
    if (host.endsWith('.tr') || host.endsWith('.com.tr')) return 'TRY';
    if (host.endsWith('.jp')) return 'JPY';
    if (host.endsWith('.de') || host.endsWith('.fr') || host.endsWith('.es') || host.endsWith('.it'))
      return 'EUR';
  } catch {
    /* ignore */
  }
  return null;
}
