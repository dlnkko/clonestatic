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
      maximumFractionDigits: code === 'JPY' || code === 'CLP' || code === 'COP' ? 0 : 2,
    }).format(n);
  } catch {
    return `${currencySymbol(code)}${n}`;
  }
}

/** Guess currency from product page URL TLD when price text is ambiguous. */
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
    if (host.endsWith('.jp')) return 'JPY';
    if (host.endsWith('.de') || host.endsWith('.fr') || host.endsWith('.es') || host.endsWith('.it'))
      return 'EUR';
  } catch {
    /* ignore */
  }
  return null;
}
