'use client';

import { useState } from 'react';
import type { ExtractedPricing, ProductImage, ProductRecord } from '@/lib/products/types';

type Mode = 'url' | 'manual';
type UrlStep = 'input' | 'review';

type ScrapePreview = {
  productUrl: string;
  name: string;
  description: string;
  targetAudience: string;
  colorPalette: string;
  branding: Record<string, unknown> | null;
  images: ProductImage[];
  extractedPricing: ExtractedPricing;
  priceDisplay: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (product: ProductRecord) => void;
};

export function ProductModal({ open, onClose, onCreated }: Props) {
  const [mode, setMode] = useState<Mode>('url');
  const [urlStep, setUrlStep] = useState<UrlStep>('input');
  const [preview, setPreview] = useState<ScrapePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [productUrl, setProductUrl] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [paletteColors, setPaletteColors] = useState<string[]>([]);
  const [priceAmount, setPriceAmount] = useState('');
  const [priceCurrency, setPriceCurrency] = useState('USD');
  const [logoFiles, setLogoFiles] = useState<File[]>([]);
  const [logoPreviews, setLogoPreviews] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  if (!open) return null;

  const currencyCodes: string[] =
    typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((Intl as any).supportedValuesOf('currency') as string[])
      : ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'MXN', 'BRL', 'JPY', 'KRW', 'CNY', 'INR'];

  const normalizeHex = (value: string): string | null => {
    const v = value.trim();
    if (!v) return null;
    const raw = v.startsWith('#') ? v : `#${v}`;
    if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(raw)) return null;
    return raw.toUpperCase();
  };

  const parsePalette = (value: string): string[] => {
    const tokens = value
      .split(/[\s,;|]+/)
      .map((t) => normalizeHex(t))
      .filter(Boolean) as string[];
    const uniq: string[] = [];
    for (const c of tokens) {
      if (!uniq.includes(c)) uniq.push(c);
      if (uniq.length >= 8) break;
    }
    return uniq;
  };

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

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('Read failed'));
      r.readAsDataURL(file);
    });

  const handleLogos = (files: FileList | null) => {
    const list = files ? Array.from(files).slice(0, 2) : [];
    setLogoFiles(list);
    logoPreviews.forEach((u) => URL.revokeObjectURL(u));
    setLogoPreviews(list.map((f) => URL.createObjectURL(f)));
  };

  const handleImages = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, 10);
    setImageFiles(list);
    imagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setImagePreviews(list.map((f) => URL.createObjectURL(f)));
  };

  const resetForm = () => {
    setError(null);
    setUrlStep('input');
    setPreview(null);
    setProductUrl('');
    setName('');
    setDescription('');
    setTargetAudience('');
    setPaletteColors([]);
    setPriceAmount('');
    setPriceCurrency('USD');
    setLogoFiles([]);
    logoPreviews.forEach((u) => URL.revokeObjectURL(u));
    setLogoPreviews([]);
    setImageFiles([]);
    imagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setImagePreviews([]);
  };

  const handleScrapePreview = async () => {
    if (!productUrl.trim()) {
      setError('Product page URL is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/products/preview-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productUrl: productUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scrape failed');
      const p = data.preview as ScrapePreview;
      setPreview(p);
      setName(p.name);
      setDescription(p.description);
      setTargetAudience(p.targetAudience);
      setPaletteColors(parsePalette(p.colorPalette));
      const detectedCurrency = p.extractedPricing?.currency?.toUpperCase?.() || 'USD';
      setPriceCurrency(currencyCodes.includes(detectedCurrency) ? detectedCurrency : 'USD');
      setPriceAmount(
        (p.priceDisplay || '')
          .replace(/[^\d.,]/g, '')
          .replace(',', '.')
          .trim()
      );
      setUrlStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scrape failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFromPreview = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const logoBase64List =
        logoFiles.length > 0 ? await Promise.all(logoFiles.map(readFileAsDataUrl)) : undefined;
      const priceDisplay = formatPrice(priceAmount, priceCurrency);
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          source: 'url',
          saveFromPreview: true,
          productUrl: preview.productUrl,
          name: name.trim(),
          description: description.trim(),
          targetAudience: targetAudience.trim(),
          colorPalette: paletteColors.join(', '),
          priceDisplay: priceDisplay || null,
          logoBase64List,
          branding: preview.branding,
          extractedPricing: preview.extractedPricing,
          images: preview.images,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save product');
      onCreated(data.product);
      resetForm();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitManual = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error('Product name is required');
      if (!description.trim()) throw new Error('Product description is required');
      if (!targetAudience.trim()) throw new Error('Target audience is required');
      if (paletteColors.length < 1) throw new Error('Select at least one brand color');
      if (imageFiles.length < 1) throw new Error('Upload at least one product image');

      const imageBase64List = await Promise.all(imageFiles.map(readFileAsDataUrl));
      const logoBase64List =
        logoFiles.length > 0 ? await Promise.all(logoFiles.map(readFileAsDataUrl)) : undefined;
      const priceDisplay = formatPrice(priceAmount, priceCurrency) || undefined;

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          source: 'manual',
          name: name.trim(),
          description: description.trim(),
          targetAudience: targetAudience.trim(),
          colorPalette: paletteColors.join(', '),
          priceDisplay,
          imageBase64List,
          logoBase64List,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create product');
      onCreated(data.product);
      resetForm();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const palettePicker = (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="block text-xs font-medium text-slate-600">Brand colors</label>
        <button
          type="button"
          onClick={() => setPaletteColors([])}
          className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
        >
          Clear
        </button>
      </div>
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
        {paletteColors.length === 0 && (
          <span className="text-xs text-slate-500">Add 1–8 brand colors (hex).</span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="color"
          aria-label="Pick color"
          onChange={(e) => {
            const c = normalizeHex(e.target.value);
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
            const c = normalizeHex(v);
            if (!c) return;
            setPaletteColors((prev) => (prev.includes(c) || prev.length >= 8 ? prev : [...prev, c]));
            (e.target as HTMLInputElement).value = '';
          }}
        />
        <button
          type="button"
          onClick={() => {
            const input = document.activeElement?.tagName === 'INPUT' ? (document.activeElement as HTMLInputElement) : null;
            const v = input?.value ?? '';
            const c = normalizeHex(v);
            if (!c) return;
            setPaletteColors((prev) => (prev.includes(c) || prev.length >= 8 ? prev : [...prev, c]));
            if (input) input.value = '';
          }}
          className="dash-btn dash-btn-secondary"
        >
          Add
        </button>
      </div>
    </div>
  );

  const priceFields = (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-600">Price amount (optional)</label>
        <input
          value={priceAmount}
          onChange={(e) => setPriceAmount(e.target.value)}
          inputMode="decimal"
          placeholder="e.g. 120"
          className="dash-input"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Currency</label>
        <input
          list="currency-codes"
          value={priceCurrency}
          onChange={(e) => setPriceCurrency(e.target.value.toUpperCase())}
          className="dash-input"
          placeholder="USD"
        />
        <datalist id="currency-codes">
          {currencyCodes.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <p className="sm:col-span-3 text-[11px] text-slate-500">
        This price is optional and never copied from reference ads. Leave empty to hide all prices in generated ads.
        {priceAmount && (
          <>
            {' '}
            Preview: <span className="font-medium text-slate-700">{formatPrice(priceAmount, priceCurrency) || '—'}</span>
          </>
        )}
      </p>
    </div>
  );

  const reviewFields = (
    <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        Review and tweak the essentials. We don’t show or store page markdown.
      </div>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Product name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="dash-input" />
        </div>
        {priceFields}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="dash-input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Target audience</label>
          <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="dash-input" />
        </div>
        {palettePicker}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Logo images (optional, up to 2)</label>
          <input type="file" accept="image/*" multiple onChange={(e) => handleLogos(e.target.files)} className="text-sm" />
          {logoPreviews.length > 0 && (
            <div className="mt-2 flex gap-2">
              {logoPreviews.map((src, i) => (
                <img key={i} src={src} alt="" className="h-16 w-16 rounded-lg object-contain ring-1 ring-slate-200 bg-white" />
              ))}
            </div>
          )}
        </div>
      </div>
      {preview && preview.images.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">Images found on page</p>
          <div className="flex flex-wrap gap-2">
            {preview.images.slice(0, 10).map((img, i) => (
              <img key={i} src={img.url} alt="" className="h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200" />
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Up to 10 images will be stored.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="dash-modal-root">
      <div className="dash-modal-backdrop" aria-hidden onClick={() => { resetForm(); onClose(); }} />
      <div className="dash-modal dash-animate-scale max-h-[90vh] overflow-y-auto">
        <div className="dash-modal-header">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--dash-fg)]">Add product</h2>
          <button type="button" onClick={() => { resetForm(); onClose(); }} className="dash-icon-btn" aria-label="Close">✕</button>
        </div>
        <div className="dash-modal-body">

        {mode === 'url' && urlStep === 'review' ? (
          <>
            <h3 className="text-sm font-medium text-slate-800 mb-2">Review scraped data</h3>
            {reviewFields}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setUrlStep('input')} className="dash-btn dash-btn-secondary">Back</button>
              <button type="button" onClick={handleSaveFromPreview} disabled={loading} className="dash-btn dash-btn-primary flex-1">
                {loading ? 'Saving…' : 'Save product'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="dash-segmented mb-4 w-full">
              <button type="button" onClick={() => { setMode('url'); setUrlStep('input'); }} className={`dash-segmented-item flex-1 ${mode === 'url' ? 'dash-segmented-item-active' : ''}`}>From URL</button>
              <button type="button" onClick={() => setMode('manual')} className={`dash-segmented-item flex-1 ${mode === 'manual' ? 'dash-segmented-item-active' : ''}`}>Manual</button>
            </div>

            {mode === 'url' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Paste product page URL. We scrape copy, branding, price, and images — you review before saving.</p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Product page URL</label>
                  <input type="url" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder="https://..." className="dash-input" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Product name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="dash-input" />
                </div>
                {priceFields}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">What is this product?</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="dash-input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Target audience</label>
                  <input type="text" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="dash-input" />
                </div>
                {palettePicker}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Logo images (optional, up to 2)</label>
                  <input type="file" accept="image/*" multiple onChange={(e) => handleLogos(e.target.files)} className="text-sm" />
                  {logoPreviews.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {logoPreviews.map((src, i) => (
                        <img key={i} src={src} alt="" className="h-16 w-16 rounded-lg object-contain ring-1 ring-slate-200 bg-white" />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Product images (1–10)</label>
                  <input type="file" accept="image/*" multiple onChange={(e) => handleImages(e.target.files)} className="text-sm" />
                  {imagePreviews.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {imagePreviews.map((src, i) => (
                        <img key={i} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Tip: upload packaging, product shots, lifestyle, and trust badges. We’ll auto-classify what’s most useful for cloning.
                </p>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <button
              type="button"
              onClick={mode === 'url' ? handleScrapePreview : handleSubmitManual}
              disabled={loading}
              className="dash-btn dash-btn-primary mt-4 w-full"
            >
              {loading ? (mode === 'url' ? 'Scraping…' : 'Saving…') : mode === 'url' ? 'Scrape & review' : 'Save product'}
            </button>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
