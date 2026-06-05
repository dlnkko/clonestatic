'use client';

import { useState } from 'react';
import type { ExtractedPricing, ProductPricingConfig, ProductRecord } from '@/lib/products/types';
import { BrandColorPicker } from '@/app/components/products/BrandColorPicker';
import { ImageUploadSlots } from '@/app/components/products/ImageUploadSlots';
import { ProductPricingEditor } from '@/app/components/products/ProductPricingEditor';
import {
  USER_MESSAGES,
  userMessageForProductSave,
  userMessageForProductScrape,
} from '@/lib/api-error-message';
import {
  emptyPricingConfig,
  finalizePricingConfig,
  pricingConfigFromExtracted,
} from '@/lib/products/pricing-config';

type Mode = 'url' | 'manual';
type UrlStep = 'input' | 'info' | 'assets';

type ScrapePreview = {
  productUrl: string;
  name: string;
  description: string;
  targetAudience: string;
  colorPalette: string;
  branding: Record<string, unknown> | null;
  extractedPricing: ExtractedPricing;
  priceDisplay: string;
  pricingConfig: ProductPricingConfig;
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
  const [pricingConfig, setPricingConfig] = useState<ProductPricingConfig>(emptyPricingConfig());
  const [logoFiles, setLogoFiles] = useState<File[]>([]);
  const [logoPreviews, setLogoPreviews] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  if (!open) return null;

  const parsePalette = (value: string): string[] => {
    const tokens = value
      .split(/[\s,;|]+/)
      .map((t) => {
        const v = t.trim();
        if (!v) return null;
        const raw = v.startsWith('#') ? v : `#${v}`;
        return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(raw) ? raw.toUpperCase() : null;
      })
      .filter(Boolean) as string[];
    const uniq: string[] = [];
    for (const c of tokens) {
      if (!uniq.includes(c)) uniq.push(c);
      if (uniq.length >= 8) break;
    }
    return uniq;
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('Read failed'));
      r.readAsDataURL(file);
    });

  const appendLogos = (incoming: File[]) => {
    const room = 2 - logoFiles.length;
    if (room <= 0) return;
    const next = incoming.slice(0, room);
    setLogoFiles((prev) => [...prev, ...next]);
    setLogoPreviews((prev) => [...prev, ...next.map((f) => URL.createObjectURL(f))]);
  };

  const removeLogo = (index: number) => {
    URL.revokeObjectURL(logoPreviews[index]);
    setLogoFiles((prev) => prev.filter((_, i) => i !== index));
    setLogoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const appendImages = (incoming: File[]) => {
    const room = 10 - imageFiles.length;
    if (room <= 0) return;
    const next = incoming.slice(0, room);
    setImageFiles((prev) => [...prev, ...next]);
    setImagePreviews((prev) => [...prev, ...next.map((f) => URL.createObjectURL(f))]);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
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
    setPricingConfig(emptyPricingConfig());
    setLogoFiles([]);
    logoPreviews.forEach((u) => URL.revokeObjectURL(u));
    setLogoPreviews([]);
    setImageFiles([]);
    imagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setImagePreviews([]);
  };

  const applyScrapedPricing = (p: ScrapePreview) => {
    setPricingConfig(pricingConfigFromExtracted(p.extractedPricing));
  };

  const handleScrapePreview = async () => {
    if (!productUrl.trim()) {
      setError(USER_MESSAGES.urlRequired);
      return;
    }
    try {
      new URL(productUrl.trim());
    } catch {
      setError(USER_MESSAGES.invalidUrl);
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(userMessageForProductScrape(res.status));
        return;
      }
      const p = data.preview as ScrapePreview;
      setPreview(p);
      setName(p.name);
      setDescription(p.description);
      setTargetAudience(p.targetAudience);
      setPaletteColors(parsePalette(p.colorPalette));
      applyScrapedPricing(p);
      setUrlStep('info');
    } catch {
      setError(USER_MESSAGES.scrapeFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToAssets = () => {
    if (!name.trim()) {
      setError('Product name is required');
      return;
    }
    if (!description.trim()) {
      setError('Product description is required');
      return;
    }
    if (!targetAudience.trim()) {
      setError('Target audience is required');
      return;
    }
    if (paletteColors.length < 1) {
      setError('Select at least one brand color');
      return;
    }
    setError(null);
    setUrlStep('assets');
  };

  const handleSaveFromPreview = async () => {
    if (!preview) return;
    if (imageFiles.length < 1) {
      setError('Upload at least one product image');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const imageBase64List = await Promise.all(imageFiles.map(readFileAsDataUrl));
      const logoBase64List =
        logoFiles.length > 0 ? await Promise.all(logoFiles.map(readFileAsDataUrl)) : undefined;
      const syncedPricing = finalizePricingConfig(pricingConfig);
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
          priceDisplay: syncedPricing.priceDisplay,
          pricingConfig: syncedPricing,
          imageBase64List,
          logoBase64List,
          branding: preview.branding,
          extractedPricing: preview.extractedPricing,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(userMessageForProductSave(res.status));
        return;
      }
      onCreated(data.product);
      resetForm();
      onClose();
    } catch {
      setError(USER_MESSAGES.saveProductFailed);
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
      const syncedPricing = finalizePricingConfig(pricingConfig);
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
          priceDisplay: syncedPricing.priceDisplay || undefined,
          pricingConfig: syncedPricing,
          imageBase64List,
          logoBase64List,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(userMessageForProductSave(res.status));
        return;
      }
      onCreated(data.product);
      resetForm();
      onClose();
    } catch (e) {
      if (e instanceof Error && e.message.includes('required')) {
        setError(e.message);
      } else {
        setError(USER_MESSAGES.tryAgain);
      }
    } finally {
      setLoading(false);
    }
  };

  const pricingFields = (
    <ProductPricingEditor
      config={pricingConfig}
      onChange={setPricingConfig}
      detectedPricing={preview?.extractedPricing ?? null}
    />
  );

  const logoUpload = (
    <ImageUploadSlots
      label="Logo images (optional, up to 2)"
      hint="PNG or SVG with transparent background works best."
      max={2}
      previews={logoPreviews}
      onChange={appendLogos}
      onRemove={removeLogo}
      objectFit="contain"
    />
  );

  const productImageUpload = (
    <ImageUploadSlots
      label="Product images (1–10)"
      hint="Upload packaging, product shots, lifestyle photos, and trust badges."
      max={10}
      previews={imagePreviews}
      onChange={appendImages}
      onRemove={removeImage}
    />
  );

  const infoFields = (
    <div className="product-modal-scroll space-y-5 max-h-[58vh] overflow-y-auto pr-1">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-xs leading-relaxed text-indigo-900">
        Review scraped copy, pricing, and brand colors. On the next step you will upload logo and product images.
      </div>
      <div className="product-modal-section space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Product name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="dash-input" />
        </div>
        {pricingFields}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="dash-input" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Target audience</label>
          <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="dash-input" />
        </div>
        <BrandColorPicker colors={paletteColors} onChange={setPaletteColors} />
      </div>
    </div>
  );

  const assetFields = (
    <div className="product-modal-scroll space-y-5 max-h-[58vh] overflow-y-auto pr-1">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-xs leading-relaxed text-indigo-900">
        Upload your logo and product shots. We do not scrape images from the page — use the best assets you have on hand.
      </div>
      <div className="product-modal-section space-y-4">
        {logoUpload}
        {productImageUpload}
      </div>
    </div>
  );

  const manualFields = (
    <div className="product-modal-section space-y-5">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Product name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="dash-input" />
      </div>
      {pricingFields}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">What is this product?</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="dash-input" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Target audience</label>
        <input type="text" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="dash-input" />
      </div>
      <BrandColorPicker colors={paletteColors} onChange={setPaletteColors} />
      {logoUpload}
      {productImageUpload}
    </div>
  );

  return (
    <div className="dash-modal-root">
      <div className="dash-modal-backdrop" aria-hidden onClick={() => { resetForm(); onClose(); }} />
      <div className="dash-modal dash-modal-wide dash-animate-scale max-h-[92vh] overflow-hidden flex flex-col">
        <div className="dash-modal-header">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--dash-fg)]">Add product</h2>
            <p className="mt-0.5 text-xs text-[var(--dash-muted)]">Save branding, pricing, and images for mirroring ads.</p>
          </div>
          <button type="button" onClick={() => { resetForm(); onClose(); }} className="dash-icon-btn" aria-label="Close">✕</button>
        </div>
        <div className="dash-modal-body flex-1 overflow-y-auto">

        {mode === 'url' && urlStep === 'info' ? (
          <>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Review scraped data</h3>
            {infoFields}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setUrlStep('input')} className="dash-btn dash-btn-secondary">Back</button>
              <button type="button" onClick={handleContinueToAssets} className="dash-btn dash-btn-primary flex-1">
                Continue
              </button>
            </div>
          </>
        ) : mode === 'url' && urlStep === 'assets' ? (
          <>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Upload images</h3>
            {assetFields}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setUrlStep('info')} className="dash-btn dash-btn-secondary">Back</button>
              <button type="button" onClick={handleSaveFromPreview} disabled={loading} className="dash-btn dash-btn-primary flex-1">
                {loading ? 'Saving…' : 'Save product'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="dash-segmented mb-5 w-full">
              <button type="button" onClick={() => { setMode('url'); setUrlStep('input'); }} className={`dash-segmented-item flex-1 ${mode === 'url' ? 'dash-segmented-item-active' : ''}`}>From URL</button>
              <button type="button" onClick={() => setMode('manual')} className={`dash-segmented-item flex-1 ${mode === 'manual' ? 'dash-segmented-item-active' : ''}`}>Manual</button>
            </div>

            {mode === 'url' ? (
              <div className="product-modal-section space-y-3">
                <p className="text-xs leading-relaxed text-slate-500">
                  Paste a product page URL. We scrape copy, branding, and pricing — then you upload logo and product images yourself.
                </p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Product page URL</label>
                  <input type="url" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder="https://..." className="dash-input" />
                </div>
              </div>
            ) : (
              manualFields
            )}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <button
              type="button"
              onClick={mode === 'url' ? handleScrapePreview : handleSubmitManual}
              disabled={loading}
              className="dash-btn dash-btn-primary mt-5 w-full"
            >
              {loading ? (mode === 'url' ? 'Scraping…' : 'Saving…') : mode === 'url' ? 'Scrape product info' : 'Save product'}
            </button>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
