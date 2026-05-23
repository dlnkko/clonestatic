'use client';

import { useEffect, useState } from 'react';
import type { ProductRecord, ProductScrapeCache } from '@/lib/products/types';

type Props = {
  product: ProductRecord | null;
  onClose: () => void;
  onSaved: (product: ProductRecord) => void;
  onDeleted?: (id: string) => void;
};

export function ProductDetailPanel({ product, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [colorPalette, setColorPalette] = useState('');
  const [priceDisplay, setPriceDisplay] = useState('');
  const [summary, setSummary] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setDescription(product.description ?? '');
    setTargetAudience(product.target_audience ?? '');
    setColorPalette(product.color_palette?.colors?.join(', ') ?? '');
    setPriceDisplay(product.scrape_cache?.priceDisplay ?? product.scrape_cache?.extractedPricing?.salePrice ?? product.scrape_cache?.extractedPricing?.regularPrice ?? '');
    setSummary(product.scrape_cache?.summary ?? product.description ?? '');
    setMarkdown(product.scrape_cache?.markdown ?? '');
    setError(null);
  }, [product]);

  if (!product) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const scrape_cache: ProductScrapeCache | null = product.scrape_cache
        ? {
            ...product.scrape_cache,
            summary,
            markdown: markdown || product.scrape_cache.markdown,
            priceDisplay: priceDisplay.trim() || null,
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
          color_palette: colorPalette.trim(),
          priceDisplay: priceDisplay.trim() || null,
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
    <div className="dash-drawer-root">
      <div className="dash-drawer max-w-xl">
        <div className="dash-modal-header">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--dash-fg)]">Product details</h2>
          <button type="button" onClick={onClose} className="dash-icon-btn" aria-label="Close">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex gap-3">
            <img src={product.primary_image_url} alt="" className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">{product.source === 'url' ? 'From URL' : 'Manual'}</p>
              {product.product_url && (
                <a href={product.product_url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 truncate block hover:underline">{product.product_url}</a>
              )}
              <p className="text-xs text-slate-500 mt-1">{product.images.length} images stored</p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Product name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="dash-input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="dash-input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Target audience</label>
            <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="dash-input" placeholder="Optional" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Color palette</label>
            <input value={colorPalette} onChange={(e) => setColorPalette(e.target.value)} className="dash-input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Price for ads (only this may appear)</label>
            <input value={priceDisplay} onChange={(e) => setPriceDisplay(e.target.value)} placeholder="e.g. $120 — leave empty to hide all prices" className="dash-input" />
            <p className="mt-1 text-[11px] text-slate-500">Never copied from reference ads. Empty = no price badge in generated ads.</p>
            {product.scrape_cache?.extractedPricing && (
              <p className="mt-1 text-[11px] text-slate-400">
                Detected from page: {product.scrape_cache.extractedPricing.regularPrice}
                {product.scrape_cache.extractedPricing.salePrice && product.scrape_cache.extractedPricing.salePrice !== product.scrape_cache.extractedPricing.regularPrice
                  ? ` (sale: ${product.scrape_cache.extractedPricing.salePrice})`
                  : ''}
              </p>
            )}
          </div>

          {product.scrape_cache && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Scraped summary</label>
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Scraped page content (markdown)</label>
                <textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} rows={8} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-mono leading-relaxed" />
              </div>
              {product.scrape_cache.branding && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Branding (JSON)</label>
                  <pre className="max-h-40 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] text-slate-700">{JSON.stringify(product.scrape_cache.branding, null, 2)}</pre>
                </div>
              )}
            </>
          )}

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600">Product images</label>
            <div className="flex flex-wrap gap-2">
              {product.images.map((img, i) => (
                <a key={i} href={img.url} target="_blank" rel="noopener noreferrer" className="block h-16 w-16 overflow-hidden rounded-lg ring-1 ring-slate-200">
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="dash-modal-footer flex-wrap gap-2">
          <button type="button" onClick={handleSave} disabled={saving} className="dash-btn dash-btn-primary flex-1">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" onClick={handleDelete} className="dash-btn dash-btn-secondary text-red-600 border-red-200 hover:bg-red-50">Delete</button>
        </div>
      </div>
    </div>
  );
}
