import { formatProductPrice, normalizeProductCurrency, parsePriceNumeric, sanitizePriceInput } from './currencies';
import type { ExtractedPricing, PricingTier, ProductPricingConfig } from './types';

export function createTierId(): string {
  return `tier_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyPricingConfig(currency = 'USD'): ProductPricingConfig {
  return {
    mode: 'single',
    currency: normalizeProductCurrency(currency),
    priceDisplay: null,
    compareAtPrice: null,
    tiers: [],
  };
}

export function formatTierUnitPrice(amount: string, currency: string): string {
  const formatted = formatProductPrice(amount, currency);
  return formatted ? `${formatted}/each` : '';
}

export function pricingConfigFromExtracted(extracted: ExtractedPricing | null | undefined): ProductPricingConfig {
  const currency = normalizeProductCurrency(extracted?.currency);
  const tiers = extracted?.tiers?.length ? extracted.tiers.map((t) => ({ ...t })) : [];

  if (tiers.length >= 2) {
    const defaultTier = tiers.find((t) => t.isDefault) ?? tiers[0];
    return {
      mode: 'tiers',
      currency,
      priceDisplay: defaultTier?.unitPrice ?? extracted?.salePrice ?? extracted?.regularPrice ?? null,
      compareAtPrice: extracted?.compareAtPrice ?? extracted?.regularPrice ?? null,
      tiers,
    };
  }

  const hasDiscount =
    extracted?.regularPrice &&
    extracted?.salePrice &&
    extracted.regularPrice !== extracted.salePrice;

  return {
    mode: 'single',
    currency,
    priceDisplay: extracted?.salePrice ?? extracted?.regularPrice ?? null,
    compareAtPrice: hasDiscount ? extracted?.regularPrice ?? null : extracted?.compareAtPrice ?? null,
    tiers: tiers.length ? tiers : [],
  };
}

export function syncPricingConfigDefaults(config: ProductPricingConfig): ProductPricingConfig {
  const currency = normalizeProductCurrency(config.currency);
  if (config.mode === 'tiers' && config.tiers && config.tiers.length > 0) {
    const defaultTier = config.tiers.find((t) => t.isDefault) ?? config.tiers[0];
    return {
      ...config,
      currency,
      priceDisplay: defaultTier.unitPrice || config.priceDisplay,
    };
  }
  return { ...config, currency };
}

/** Format stored price strings before save (call on blur or submit). */
export function finalizePricingConfig(config: ProductPricingConfig): ProductPricingConfig {
  const synced = syncPricingConfigDefaults(config);
  const currency = synced.currency;

  const formatSingle = (value: string | null | undefined): string | null => {
    if (!value?.trim()) return null;
    const num = parsePriceNumeric(value);
    if (!num) return null;
    return formatProductPrice(num, currency) || null;
  };

  const tiers = synced.tiers?.map((tier) => ({
    ...tier,
    unitPrice: tier.unitPrice?.trim()
      ? normalizeTierUnitPrice(parsePriceNumeric(tier.unitPrice), currency)
      : tier.unitPrice,
  }));

  return {
    ...synced,
    priceDisplay: formatSingle(synced.priceDisplay),
    compareAtPrice: formatSingle(synced.compareAtPrice),
    tiers,
  };
}

export function buildAllowedPriceFromConfig(config: ProductPricingConfig | null | undefined): string | null {
  if (!config) return null;
  const synced = syncPricingConfigDefaults(config);
  if (synced.priceDisplay?.trim()) return synced.priceDisplay.trim();

  if (synced.mode === 'tiers' && synced.tiers?.length) {
    const t = synced.tiers.find((x) => x.isDefault) ?? synced.tiers[0];
    return t?.unitPrice?.trim() || null;
  }
  return null;
}

export function pricingInstructionsFromConfig(config: ProductPricingConfig | null | undefined): string | null {
  const allowed = buildAllowedPriceFromConfig(config);
  if (!allowed) return null;

  if (config?.mode === 'tiers' && config.tiers && config.tiers.length >= 2) {
    const tierLines = config.tiers
      .map((t) => {
        const parts = [t.label, t.unitPrice];
        if (t.discountPercent) parts.push(`Save ${t.discountPercent}%`);
        if (t.badge) parts.push(t.badge);
        return parts.filter(Boolean).join(' — ');
      })
      .join('; ');
    return `${allowed} (default tier). Available tiers: ${tierLines}. Use ONLY these verified prices — never copy reference ad prices.`;
  }

  if (config?.compareAtPrice && config.compareAtPrice !== allowed) {
    return `Sale price: ${allowed}. Compare-at: ${config.compareAtPrice}. Use ONLY these amounts.`;
  }

  return allowed;
}

export function newEmptyTier(currency: string): PricingTier {
  return {
    id: createTierId(),
    label: '',
    unitPrice: '',
    discountPercent: null,
    badge: null,
    isDefault: false,
  };
}

export function normalizeTierUnitPrice(raw: string, currency: string): string {
  const num = parsePriceNumeric(raw);
  if (!num) return sanitizePriceInput(raw.trim());
  if (/\/\s*each/i.test(raw)) return raw.trim();
  return formatTierUnitPrice(num, currency);
}
