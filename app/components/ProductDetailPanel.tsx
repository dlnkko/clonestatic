'use client';

import { useEffect, useState } from 'react';
import type { ProductRecord, ProductScrapeCache } from '@/lib/products/types';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import { BrandColorPicker } from '@/app/components/products/BrandColorPicker';
import {
  formatProductPrice,
  normalizeProductCurrency,
  PRODUCT_CURRENCIES,
} from '@/lib/products/currencies';

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
  const [priceAmount, setPriceAmount] = useState('');
  const [priceCurrency, setPriceCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setDescription(product.description ?? '');
    setTargetAudience(product.target_audience ?? '');
    setPaletteColors((product.color_palette?.colors ?? []).map((c) => c.toUpperCase()).slice(0, 8));
    const detectedCurrency = normalizeProductCurrency(product.scrape_cache?.extractedPricing?.currency);
    setPriceCurrency(detectedCurrency);
    const raw =
      product.scrape_cache?.priceDisplay ??
      product.scrape_cache?.extractedPricing?.salePrice ??
      product.scrape_cache?.extractedPricing?.regularPrice ??
      '';
    setPriceAmount(raw.replace(/[^\d.,]/g, '').replace(',', '.').trim());
    setError(null);
  }, [product]);

  if (!product) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const priceDisplay = formatProductPrice(priceAmount, priceCurrency) || null;
      const scrape_cache: ProductScrapeCache | null = product.scrape_cache
        ? {
            ...product.scrape_cache,
            priceDisplay,
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
          priceDisplay,
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
              <img
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

            <div>
              <label className="dash-label mb-1.5">{t('products', 'price')}</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <input
                    value={priceAmount}
                    onChange={(e) => setPriceAmount(e.target.value)}
                    placeholder="e.g. 120"
                    className="dash-input"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <select
                    value={priceCurrency}
                    onChange={(e) => setPriceCurrency(e.target.value)}
                    className="dash-select w-full text-sm"
                  >
                    {PRODUCT_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.symbol} {c.code}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="sm:col-span-3 text-[11px] text-slate-500">
                  {t('products', 'priceHint')}{' '}
                  {priceAmount ? (
                    <>
                      Preview:{' '}
                      <span className="font-medium text-slate-700">
                        {formatProductPrice(priceAmount, priceCurrency) || '—'}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              {product.scrape_cache?.extractedPricing && (
                <p className="mt-1 text-[11px] text-slate-400">
                  {t('products', 'detectedPrice')}: {product.scrape_cache.extractedPricing.regularPrice}
                  {product.scrape_cache.extractedPricing.salePrice &&
                  product.scrape_cache.extractedPricing.salePrice !==
                    product.scrape_cache.extractedPricing.regularPrice
                    ? ` (${product.scrape_cache.extractedPricing.salePrice})`
                    : ''}
                  {product.scrape_cache.extractedPricing.currency
                    ? ` · ${product.scrape_cache.extractedPricing.currency}`
                    : ''}
                </p>
              )}
            </div>

            <div>
              <label className="dash-label mb-2">{t('products', 'productImages')}</label>
              <div className="flex flex-wrap gap-2">
                {product.images.map((img, i) => (
                  <a
                    key={i}
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block h-20 w-20 overflow-hidden rounded-xl ring-1 ring-slate-200 transition hover:ring-indigo-300"
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
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
