'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProductRecord, ProductScrapeCache } from '@/lib/products/types';
import { useI18n } from '@/lib/i18n/LocaleProvider';

type Props = {
  product: ProductRecord | null;
  onClose: () => void;
  onSaved: (product: ProductRecord) => void;
  onDeleted?: (id: string) => void;
};

function parseHexColors(input: string): string[] {
  const matches = input.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g);
  if (!matches) return [];
  return [...new Set(matches.map((h) => h.toLowerCase()))].slice(0, 12);
}

function normalizeHex(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return `#${h.slice(0, 6)}`.toLowerCase();
}

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

  const currencyCodes: string[] =
    typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((Intl as any).supportedValuesOf('currency') as string[])
      : ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'MXN', 'BRL', 'JPY', 'KRW', 'CNY', 'INR'];

  const formatPrice = (amt: string, currency: string): string => {
    const n = Number(amt);
    if (!Number.isFinite(n) || n <= 0) return '';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return `${n} ${currency}`;
    }
  };

  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setDescription(product.description ?? '');
    setTargetAudience(product.target_audience ?? '');
    setPaletteColors((product.color_palette?.colors ?? []).map((c) => c.toUpperCase()).slice(0, 8));
    const detectedCurrency = product.scrape_cache?.extractedPricing?.currency?.toUpperCase?.() || 'USD';
    setPriceCurrency(currencyCodes.includes(detectedCurrency) ? detectedCurrency : 'USD');
    const raw =
      product.scrape_cache?.priceDisplay ??
      product.scrape_cache?.extractedPricing?.salePrice ??
      product.scrape_cache?.extractedPricing?.regularPrice ??
      '';
    setPriceAmount(raw.replace(/[^\d.,]/g, '').replace(',', '.').trim());
    setError(null);
  }, [product]);

  const swatches = useMemo(() => {
    const fromProduct = product?.color_palette?.colors ?? [];
    const fromInput = paletteColors;
    const merged = [...fromProduct, ...fromInput].map(normalizeHex);
    return [...new Set(merged)].slice(0, 12);
  }, [product, paletteColors]);

  if (!product) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const priceDisplay = formatPrice(priceAmount, priceCurrency) || null;
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

            <div>
              <label className="dash-label mb-2">{t('products', 'palette')}</label>
              {swatches.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {swatches.map((hex) => (
                    <span
                      key={hex}
                      title={hex}
                      className="h-10 w-10 rounded-xl ring-1 ring-black/10 shadow-sm"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              ) : (
                <p className="mb-2 text-xs text-slate-400">#574CD5, #FF4500, …</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {paletteColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPaletteColors((prev) => prev.filter((x) => x !== c))}
                    className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300"
                    title="Remove color"
                  >
                    <span className="h-4 w-4 rounded-full ring-1 ring-slate-200" style={{ background: c }} />
                    <span>{c}</span>
                    <span className="text-slate-400 group-hover:text-slate-600">✕</span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick color"
                  onChange={(e) => {
                    const c = e.target.value.toUpperCase();
                    if (!c) return;
                    setPaletteColors((prev) => (prev.includes(c) || prev.length >= 8 ? prev : [...prev, c]));
                  }}
                  className="h-9 w-10 rounded-lg border border-slate-200 bg-white p-1"
                />
                <input
                  type="text"
                  placeholder="#1F2937"
                  className="dash-input flex-1"
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    const v = (e.target as HTMLInputElement).value;
                    const matches = parseHexColors(v);
                    if (!matches.length) return;
                    setPaletteColors((prev) => {
                      const next = [...prev];
                      for (const h of matches) {
                        const c = h.toUpperCase();
                        if (!next.includes(c) && next.length < 8) next.push(c);
                      }
                      return next;
                    });
                    (e.target as HTMLInputElement).value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setPaletteColors((prev) => prev.slice(0, Math.max(0, prev.length - 1)))}
                  className="dash-btn dash-btn-secondary"
                >
                  Undo
                </button>
              </div>
            </div>

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
                  <input
                    list="currency-codes-edit"
                    value={priceCurrency}
                    onChange={(e) => setPriceCurrency(e.target.value.toUpperCase())}
                    className="dash-input"
                    placeholder="USD"
                  />
                  <datalist id="currency-codes-edit">
                    {currencyCodes.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <p className="sm:col-span-3 text-[11px] text-slate-500">
                  {t('products', 'priceHint')}{' '}
                  {priceAmount ? (
                    <>
                      Preview:{' '}
                      <span className="font-medium text-slate-700">
                        {formatPrice(priceAmount, priceCurrency) || '—'}
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
