'use client';

import type { ExtractedPricing, PricingTier, ProductPricingConfig } from '@/lib/products/types';
import {
  formatTierUnitPrice,
  newEmptyTier,
  normalizeTierUnitPrice,
  syncPricingConfigDefaults,
} from '@/lib/products/pricing-config';
import {
  formatProductPrice,
  parsePriceNumeric,
  PRODUCT_CURRENCIES,
  sanitizePriceInput,
} from '@/lib/products/currencies';

type Props = {
  config: ProductPricingConfig;
  onChange: (config: ProductPricingConfig) => void;
  detectedPricing?: ExtractedPricing | null;
};

export function ProductPricingEditor({ config, onChange, detectedPricing }: Props) {
  const synced = syncPricingConfigDefaults(config);
  const currency = synced.currency;

  const setMode = (mode: 'single' | 'tiers') => {
    if (mode === 'tiers' && (!synced.tiers || synced.tiers.length === 0)) {
      const seed =
        detectedPricing?.tiers?.map((t) => ({ ...t })) ??
        (synced.priceDisplay
          ? [
              {
                ...newEmptyTier(currency),
                label: '1 unit',
                unitPrice: synced.priceDisplay,
                isDefault: true,
              },
            ]
          : [newEmptyTier(currency)]);
      onChange({ ...synced, mode: 'tiers', tiers: seed });
      return;
    }
    onChange({ ...synced, mode });
  };

  const updateTier = (id: string, patch: Partial<PricingTier>) => {
    const tiers = (synced.tiers ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t));
    onChange(syncPricingConfigDefaults({ ...synced, tiers }));
  };

  const setDefaultTier = (id: string) => {
    const tiers = (synced.tiers ?? []).map((t) => ({ ...t, isDefault: t.id === id }));
    onChange(syncPricingConfigDefaults({ ...synced, tiers }));
  };

  const addTier = () => {
    const tiers = [...(synced.tiers ?? []), newEmptyTier(currency)];
    onChange({ ...synced, mode: 'tiers', tiers });
  };

  const removeTier = (id: string) => {
    const tiers = (synced.tiers ?? []).filter((t) => t.id !== id);
    onChange(
      syncPricingConfigDefaults({
        ...synced,
        mode: tiers.length >= 2 ? 'tiers' : 'single',
        tiers,
      })
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-600">Pricing</label>
        <div className="dash-segmented text-[11px]">
          <button
            type="button"
            className={`dash-segmented-item px-3 py-1 ${synced.mode === 'single' ? 'dash-segmented-item-active' : ''}`}
            onClick={() => setMode('single')}
          >
            Single price
          </button>
          <button
            type="button"
            className={`dash-segmented-item px-3 py-1 ${synced.mode === 'tiers' ? 'dash-segmented-item-active' : ''}`}
            onClick={() => setMode('tiers')}
          >
            Bundles / tiers
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] text-slate-500">Currency</label>
          <select
            value={currency}
            onChange={(e) => onChange({ ...synced, currency: e.target.value })}
            className="dash-select w-full text-sm"
          >
            {PRODUCT_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code} — {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {synced.mode === 'single' ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">Price (optional)</label>
            <input
              value={parsePriceNumeric(synced.priceDisplay)}
              onChange={(e) =>
                onChange({
                  ...synced,
                  priceDisplay: sanitizePriceInput(e.target.value) || null,
                })
              }
              onBlur={(e) => {
                const num = parsePriceNumeric(e.target.value);
                onChange({
                  ...synced,
                  priceDisplay: num ? formatProductPrice(num, currency) || null : null,
                });
              }}
              inputMode="decimal"
              placeholder="e.g. 12.00"
              className="dash-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">Compare-at / was (optional)</label>
            <input
              value={parsePriceNumeric(synced.compareAtPrice ?? '')}
              onChange={(e) =>
                onChange({
                  ...synced,
                  compareAtPrice: sanitizePriceInput(e.target.value) || null,
                })
              }
              onBlur={(e) => {
                const num = parsePriceNumeric(e.target.value);
                onChange({
                  ...synced,
                  compareAtPrice: num ? formatProductPrice(num, currency) || null : null,
                });
              }}
              inputMode="decimal"
              placeholder="e.g. 15.00"
              className="dash-input"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {(synced.tiers ?? []).map((tier) => (
            <div
              key={tier.id}
              className={`rounded-xl border p-3 ${tier.isDefault ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200 bg-white'}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-[11px] text-slate-600">
                  <input
                    type="radio"
                    name="default-tier"
                    checked={tier.isDefault === true}
                    onChange={() => setDefaultTier(tier.id)}
                  />
                  Default for ads
                </label>
                {(synced.tiers?.length ?? 0) > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTier(tier.id)}
                    className="text-[11px] text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">Quantity / bundle label</label>
                  <input
                    value={tier.label}
                    onChange={(e) => updateTier(tier.id, { label: e.target.value })}
                    placeholder="e.g. 4 Bars"
                    className="dash-input text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">Unit price</label>
                  <input
                    value={parsePriceNumeric(tier.unitPrice)}
                    onChange={(e) =>
                      updateTier(tier.id, {
                        unitPrice: sanitizePriceInput(e.target.value),
                      })
                    }
                    onBlur={(e) =>
                      updateTier(tier.id, {
                        unitPrice: normalizeTierUnitPrice(e.target.value, currency),
                      })
                    }
                    inputMode="decimal"
                    placeholder="12.00"
                    className="dash-input text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">Discount % (optional)</label>
                  <input
                    value={tier.discountPercent ?? ''}
                    onChange={(e) =>
                      updateTier(tier.id, {
                        discountPercent: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    inputMode="numeric"
                    placeholder="15"
                    className="dash-input text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">Badge (optional)</label>
                  <input
                    value={tier.badge ?? ''}
                    onChange={(e) => updateTier(tier.id, { badge: e.target.value || null })}
                    placeholder="Most popular"
                    className="dash-input text-sm"
                  />
                </div>
              </div>
              {tier.unitPrice ? (
                <p className="mt-2 text-[10px] text-slate-500">
                  Preview: {formatTierUnitPrice(parsePriceNumeric(tier.unitPrice), currency) || tier.unitPrice}
                  {tier.discountPercent ? ` · Save ${tier.discountPercent}%` : ''}
                </p>
              ) : null}
            </div>
          ))}
          <button type="button" onClick={addTier} className="dash-btn dash-btn-secondary w-full text-sm">
            + Add bundle / tier
          </button>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-500">
        Optional. Never copied from reference ads — leave empty to hide prices in generated ads.
        {synced.priceDisplay ? (
          <>
            {' '}
            Ad default:{' '}
            <span className="font-medium text-slate-700">{synced.priceDisplay}</span>
          </>
        ) : null}
      </p>

      {detectedPricing?.tiers && detectedPricing.tiers.length >= 2 && (
        <p className="text-[10px] text-slate-400">
          Scraped {detectedPricing.tiers.length} tiers from the product page.
        </p>
      )}
    </div>
  );
}
