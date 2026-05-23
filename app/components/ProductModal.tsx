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
  summary: string;
  branding: Record<string, unknown> | null;
  markdown: string | null;
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
  const [colorPalette, setColorPalette] = useState('');
  const [priceDisplay, setPriceDisplay] = useState('');
  const [summary, setSummary] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  if (!open) return null;

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('Read failed'));
      r.readAsDataURL(file);
    });

  const handleLogo = (file: File | null) => {
    setLogoFile(file);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleImages = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, 3);
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
    setColorPalette('');
    setPriceDisplay('');
    setSummary('');
    setMarkdown('');
    handleLogo(null);
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
      setColorPalette(p.colorPalette);
      setPriceDisplay(p.priceDisplay);
      setSummary(p.summary);
      setMarkdown(p.markdown ?? '');
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
          colorPalette: colorPalette.trim(),
          priceDisplay: priceDisplay.trim(),
          summary: summary.trim(),
          markdown: markdown.trim(),
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
      if (!colorPalette.trim()) throw new Error('Color palette is required');
      if (imageFiles.length < 1) throw new Error('Upload at least one product image');

      const imageBase64List = await Promise.all(imageFiles.map(readFileAsDataUrl));
      const logoBase64 = logoFile ? await readFileAsDataUrl(logoFile) : undefined;

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          source: 'manual',
          name: name.trim(),
          description: description.trim(),
          targetAudience: targetAudience.trim(),
          colorPalette: colorPalette.trim(),
          priceDisplay: priceDisplay.trim() || undefined,
          imageBase64List,
          logoBase64,
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

  const reviewFields = (
    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
      <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">Review scraped data before saving. Fix price if wrong — only this price may appear in ads.</p>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Product name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="dash-input" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Price for ads</label>
        <input value={priceDisplay} onChange={(e) => setPriceDisplay(e.target.value)} placeholder="e.g. $120" className="dash-input" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="dash-input" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Target audience</label>
        <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="dash-input" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Color palette</label>
        <input value={colorPalette} onChange={(e) => setColorPalette(e.target.value)} className="dash-input" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Summary</label>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Page markdown</label>
        <textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} rows={5} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-mono" />
      </div>
      {preview && preview.images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {preview.images.slice(0, 8).map((img, i) => (
            <img key={i} src={img.url} alt="" className="h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200" />
          ))}
          <p className="w-full text-[10px] text-slate-500">{preview.images.length} images will be stored</p>
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
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Price for ads (optional)</label>
                  <input type="text" value={priceDisplay} onChange={(e) => setPriceDisplay(e.target.value)} placeholder="e.g. $120" className="dash-input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">What is this product?</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="dash-input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Target audience</label>
                  <input type="text" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="dash-input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Color palette</label>
                  <input type="text" value={colorPalette} onChange={(e) => setColorPalette(e.target.value)} className="dash-input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Logo image</label>
                  <input type="file" accept="image/*" onChange={(e) => handleLogo(e.target.files?.[0] ?? null)} className="text-sm" />
                  {logoPreview && <img src={logoPreview} alt="" className="mt-2 h-16 w-16 rounded-lg object-contain" />}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Product images (1–3)</label>
                  <input type="file" accept="image/*" multiple onChange={(e) => handleImages(e.target.files)} className="text-sm" />
                  {imagePreviews.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {imagePreviews.map((src, i) => (
                        <img key={i} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      ))}
                    </div>
                  )}
                </div>
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
