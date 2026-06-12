'use client';

import { useEffect, useState } from 'react';
import type { ProductRecord, ProductScrapeCache, ProductPricingConfig } from '@/lib/products/types';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import { BrandColorPicker } from '@/app/components/products/BrandColorPicker';
import { ProductPricingEditor } from '@/app/components/products/ProductPricingEditor';
import {
  emptyPricingConfig,
  finalizePricingConfig,
  pricingConfigFromExtracted,
} from '@/lib/products/pricing-config';
import { ProxiedImage } from '@/app/components/ProxiedImage';

type Props = {
  product: ProductRecord | null;
  onClose: () => void;
  onSaved: (product: ProductRecord) => void;
  onDeleted?: (id: string) => void;
};

export function ProductDetailPanel({ product, onClose, onSaved, onDeleted }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [paletteColors, setPaletteColors] = useState<string[]>([]);
  const [pricingConfig, setPricingConfig] = useState<ProductPricingConfig>(emptyPricingConfig());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setDescription(product.description ?? '');
    setTargetAudience(product.target_audience ?? '');
    setPaletteColors((product.color_palette?.colors ?? []).map((c) => c.toUpperCase()).slice(0, 8));
    const existingConfig = product.scrape_cache?.pricingConfig;
    if (existingConfig) {
      setPricingConfig(existingConfig);
    } else if (product.scrape_cache?.extractedPricing || product.scrape_cache?.priceDisplay) {
      const fromExtracted = pricingConfigFromExtracted(product.scrape_cache?.extractedPricing);
      setPricingConfig({
        ...fromExtracted,
        priceDisplay: product.scrape_cache?.priceDisplay ?? fromExtracted.priceDisplay,
      });
    } else {
      setPricingConfig(emptyPricingConfig());
    }
    setError(null);
  }, [product]);

  if (!product) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const syncedPricing = finalizePricingConfig(pricingConfig);
      const scrape_cache: ProductScrapeCache | null = product.scrape_cache
        ? {
            ...product.scrape_cache,
            priceDisplay: syncedPricing.priceDisplay,
            pricingConfig: syncedPricing,
          }
        : null;

      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          target_audience: targetAudience.trim(),
          color_palette: paletteColors.join(', '),
          priceDisplay: syncedPricing.priceDisplay,
          pricingConfig: syncedPricing,
          scrape_cache,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      onSaved(data.product);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this product?')) return;
    const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      onDeleted?.(product.id);
      onClose();
    }
  };

  return (
    <div className="dash-modal-root dash-modal-root--center" role="dialog" aria-modal="true">
      <div className="dash-product-edit-modal">
        <div className="dash-modal-header">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--dash-fg)]">
            {t('products', 'editTitle')}
          </h2>
          <button type="button" onClick={onClose} className="dash-icon-btn" aria-label={t('common', 'close')}>
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-8">
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            <div className="flex gap-4 rounded-2xl border border-[var(--dash-border)] bg-slate-50/80 p-4">
              <ProxiedImage
                src={product.primary_image_url}
                alt=""
                className="h-24 w-24 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {product.source === 'url' ? t('products', 'fromUrl') : t('products', 'manual')}
                </p>
                {product.product_url && (
                  <a
                    href={product.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-sm text-sky-600 hover:underline"
                  >
                    {product.product_url}
                  </a>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  {t('products', 'imagesStored', { count: product.images.length })}
                </p>
              </div>
            </div>

            <div>
              <label className="dash-label mb-1.5">{t('products', 'name')}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="dash-input" />
            </div>
            <div>
              <label className="dash-label mb-1.5">{t('products', 'description')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="dash-input dash-textarea"
              />
            </div>
            <div>
              <label className="dash-label mb-1.5">{t('products', 'audience')}</label>
              <input
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="dash-input"
                placeholder={t('products', 'audiencePh')}
              />
            </div>

            <BrandColorPicker colors={paletteColors} onChange={setPaletteColors} />

            <ProductPricingEditor
              config={pricingConfig}
              onChange={setPricingConfig}
              detectedPricing={product.scrape_cache?.extractedPricing ?? null}
            />

            <div>
              <label className="dash-label mb-2">{t('products', 'productImages')}</label>
              <div className="flex flex-wrap gap-2">
                {product.images.map((img, i) => (
                  <a
                    key={`${img.url}-${i}`}
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative block h-20 w-20 overflow-hidden rounded-xl ring-1 ring-slate-200 bg-white transition hover:ring-indigo-300"
                  >
                    <ProxiedImage
                      src={img.url}
                      alt=""
                      className={`h-full w-full ${img.kind === 'logo' ? 'object-contain p-1' : 'object-cover'}`}
                    />
                    {img.kind === 'logo' && (
                      <span className="absolute left-0.5 top-0.5 rounded bg-black/70 px-1 text-[8px] text-white">
                        Logo
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>

        <div className="dash-modal-footer flex-wrap gap-2 border-t border-[var(--dash-border)]">
          <button type="button" onClick={handleSave} disabled={saving} className="dash-btn dash-btn-primary flex-1 min-h-[48px]">
            {saving ? t('products', 'saving') : t('products', 'save')}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="dash-btn dash-btn-secondary text-red-600 border-red-200 hover:bg-red-50 min-h-[48px]"
          >
            {t('products', 'delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
