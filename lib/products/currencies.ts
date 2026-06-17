export type CurrencyRegion = 'americas' | 'europe' | 'other';

export type CurrencyOption = {
  code: string;
  symbol: string;
  label: string;
  labelEs: string;
  flag: string;
  region: CurrencyRegion;
};

/** Curated currencies for product pricing (with display symbols). */
export const PRODUCT_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', label: 'US Dollar', labelEs: 'Dólar estadounidense', flag: '🇺🇸', region: 'americas' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar', labelEs: 'Dólar canadiense', flag: '🇨🇦', region: 'americas' },
  { code: 'MXN', symbol: '$', label: 'Mexican Peso', labelEs: 'Peso mexicano', flag: '🇲🇽', region: 'americas' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real', labelEs: 'Real brasileño', flag: '🇧🇷', region: 'americas' },
  { code: 'ARS', symbol: '$', label: 'Argentine Peso', labelEs: 'Peso argentino', flag: '🇦🇷', region: 'americas' },
  { code: 'COP', symbol: '$', label: 'Colombian Peso', labelEs: 'Peso colombiano', flag: '🇨🇴', region: 'americas' },
  { code: 'CLP', symbol: '$', label: 'Chilean Peso', labelEs: 'Peso chileno', flag: '🇨🇱', region: 'americas' },
  { code: 'PEN', symbol: 'S/', label: 'Peruvian Sol', labelEs: 'Sol peruano', flag: '🇵🇪', region: 'americas' },

  { code: 'EUR', symbol: '€', label: 'Euro', labelEs: 'Euro', flag: '🇪🇺', region: 'europe' },
  { code: 'GBP', symbol: '£', label: 'British Pound', labelEs: 'Libra esterlina', flag: '🇬🇧', region: 'europe' },
  { code: 'CHF', symbol: 'CHF', label: 'Swiss Franc', labelEs: 'Franco suizo', flag: '🇨🇭', region: 'europe' },
  { code: 'NOK', symbol: 'kr', label: 'Norwegian Krone', labelEs: 'Corona noruega', flag: '🇳🇴', region: 'europe' },
  { code: 'SEK', symbol: 'kr', label: 'Swedish Krona', labelEs: 'Corona sueca', flag: '🇸🇪', region: 'europe' },
  { code: 'DKK', symbol: 'kr', label: 'Danish Krone', labelEs: 'Corona danesa', flag: '🇩🇰', region: 'europe' },
  { code: 'ISK', symbol: 'kr', label: 'Icelandic Króna', labelEs: 'Corona islandesa', flag: '🇮🇸', region: 'europe' },
  { code: 'PLN', symbol: 'zł', label: 'Polish Zloty', labelEs: 'Zloty polaco', flag: '🇵🇱', region: 'europe' },
  { code: 'CZK', symbol: 'Kč', label: 'Czech Koruna', labelEs: 'Corona checa', flag: '🇨🇿', region: 'europe' },
  { code: 'HUF', symbol: 'Ft', label: 'Hungarian Forint', labelEs: 'Forinto húngaro', flag: '🇭🇺', region: 'europe' },
  { code: 'RON', symbol: 'lei', label: 'Romanian Leu', labelEs: 'Leu rumano', flag: '🇷🇴', region: 'europe' },
  { code: 'BGN', symbol: 'лв', label: 'Bulgarian Lev', labelEs: 'Lev búlgaro', flag: '🇧🇬', region: 'europe' },
  { code: 'ALL', symbol: 'L', label: 'Albanian Lek', labelEs: 'Lek albanés', flag: '🇦🇱', region: 'europe' },
  { code: 'RSD', symbol: 'din', label: 'Serbian Dinar', labelEs: 'Dinar serbio', flag: '🇷🇸', region: 'europe' },
  { code: 'BAM', symbol: 'KM', label: 'Bosnia Mark', labelEs: 'Marco convertible bosnio', flag: '🇧🇦', region: 'europe' },
  { code: 'MDL', symbol: 'L', label: 'Moldovan Leu', labelEs: 'Leu moldavo', flag: '🇲🇩', region: 'europe' },
  { code: 'UAH', symbol: '₴', label: 'Ukrainian Hryvnia', labelEs: 'Grivna ucraniana', flag: '🇺🇦', region: 'europe' },
  { code: 'MKD', symbol: 'ден', label: 'Macedonian Denar', labelEs: 'Denar macedonio', flag: '🇲🇰', region: 'europe' },

  { code: 'TRY', symbol: '₺', label: 'Turkish Lira', labelEs: 'Lira turca', flag: '🇹🇷', region: 'other' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen', labelEs: 'Yen japonés', flag: '🇯🇵', region: 'other' },
];

const CODE_SET = new Set(PRODUCT_CURRENCIES.map((c) => c.code));

const CURRENCY_BY_CODE = new Map(PRODUCT_CURRENCIES.map((c) => [c.code, c]));

export const CURRENCY_REGION_LABELS: Record<CurrencyRegion, { en: string; es: string }> = {
  americas: { en: 'Americas', es: 'Américas' },
  europe: { en: 'Europe', es: 'Europa' },
  other: { en: 'Other', es: 'Otros' },
};

/** Regex alternation of all supported ISO codes (for scrape / text detection). */
export function productCurrencyCodePattern(): string {
  return PRODUCT_CURRENCIES.map((c) => c.code).join('|');
}

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'CLP', 'COP', 'HUF', 'ISK']);

export function supportedProductCurrencyCodes(): string[] {
  return PRODUCT_CURRENCIES.map((c) => c.code);
}

export function getProductCurrency(code: string | null | undefined): CurrencyOption | undefined {
  const upper = (code ?? '').trim().toUpperCase();
  return CURRENCY_BY_CODE.get(upper);
}

export function normalizeProductCurrency(code: string | null | undefined): string {
  const upper = (code ?? 'USD').trim().toUpperCase();
  return CODE_SET.has(upper) ? upper : 'USD';
}

export function currencySymbol(code: string): string {
  return getProductCurrency(code)?.symbol ?? code;
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
    if (host.endsWith('.dk')) return 'DKK';
    if (host.endsWith('.is')) return 'ISK';
    if (host.endsWith('.pl')) return 'PLN';
    if (host.endsWith('.cz')) return 'CZK';
    if (host.endsWith('.hu')) return 'HUF';
    if (host.endsWith('.ro')) return 'RON';
    if (host.endsWith('.bg')) return 'BGN';
    if (host.endsWith('.al')) return 'ALL';
    if (host.endsWith('.rs')) return 'RSD';
    if (host.endsWith('.ba')) return 'BAM';
    if (host.endsWith('.md')) return 'MDL';
    if (host.endsWith('.ua')) return 'UAH';
    if (host.endsWith('.mk')) return 'MKD';
    if (host.endsWith('.tr') || host.endsWith('.com.tr')) return 'TRY';
    if (host.endsWith('.jp')) return 'JPY';
    if (host.endsWith('.de') || host.endsWith('.fr') || host.endsWith('.es') || host.endsWith('.it'))
      return 'EUR';
  } catch {
    /* ignore */
  }
  return null;
}
