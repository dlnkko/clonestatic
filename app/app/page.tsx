'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient as createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { DashboardShell } from '../components/dashboard/DashboardShell';
import { PricingModal } from '../components/dashboard/PricingModal';
import { ProductDetailPanel } from '../components/ProductDetailPanel';
import { ProductModal } from '../components/ProductModal';
import { COPY_LANGUAGES } from '@/lib/copy-languages';
import type { ProductRecord } from '@/lib/products/types';
import { adVisualModeLabel, type AdVisualMode } from '@/lib/ad-visual-mode';

/** Parse response as JSON; if body is not JSON (e.g. "Request Entity Too Large"), return null and set friendly error. */
async function parseJsonResponse<T = unknown>(res: Response): Promise<{ data: T | null; errorMessage: string | null }> {
  const text = await res.text();
  try {
    const data = (text ? JSON.parse(text) : {}) as T;
    return { data, errorMessage: null };
  } catch {
    if (res.status === 413) {
      return { data: null, errorMessage: 'Request too large. Please try again.' };
    }
    if (res.status >= 500) {
      return { data: null, errorMessage: 'Server error. Please try again in a moment.' };
    }
    return { data: null, errorMessage: text?.slice(0, 200) || 'Invalid response from server. Please try again.' };
  }
}

const MAX_IMAGE_BYTES = 320000; // ~320KB blob → ~430KB base64; 2 images stay under 1MB body

/** Compress image to JPEG data URL under maxSizeBytes (blob size). */
function compressImageForApi(file: File, maxSizeBytes: number = MAX_IMAGE_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1920;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);

      const tryQuality = (quality: number): Promise<string> =>
        new Promise((res, rej) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                rej(new Error('Failed to compress image'));
                return;
              }
              if (blob.size <= maxSizeBytes || quality <= 0.2) {
                const reader = new FileReader();
                reader.onloadend = () => res(reader.result as string);
                reader.onerror = () => rej(new Error('Read failed'));
                reader.readAsDataURL(blob);
                return;
              }
              tryQuality(Math.max(0.2, quality - 0.15)).then(res).catch(rej);
            },
            'image/jpeg',
            quality
          );
        });

      tryQuality(0.9).then(resolve).catch(reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Invalid image'));
    };
    img.src = url;
  });
}

export type ImageSizeOption = '9:16' | '16:9' | '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '1:4' | '1:8' | '4:1' | '8:1' | '21:9' | 'auto';

const ASPECT_RATIO_OPTIONS: { value: ImageSizeOption; label: string }[] = [
  { value: 'auto', label: 'Auto (match reference)' },
  { value: '9:16', label: 'Vertical 9:16' },
  { value: '16:9', label: 'Horizontal 16:9' },
  { value: '1:1', label: 'Square 1:1' },
  { value: '2:3', label: '2:3' },
  { value: '3:2', label: '3:2' },
  { value: '3:4', label: '3:4' },
  { value: '4:3', label: '4:3' },
  { value: '4:5', label: '4:5' },
  { value: '5:4', label: '5:4' },
  { value: '1:4', label: '1:4' },
  { value: '1:8', label: '1:8' },
  { value: '4:1', label: '4:1' },
  { value: '8:1', label: '8:1' },
  { value: '21:9', label: '21:9' },
];

export type CreationItem = {
  id: string;
  image_url: string | null;
  aspect_ratio: string | null;
  created_at: string;
  status?: 'generating' | 'completed';
};

export type CompetitorAdItem = {
  ad_archive_id?: string;
  page_name?: string;
  snapshot?: {
    body?: { text?: string };
    images?: { resized_image_url?: string; original_image_url?: string }[];
  };
  total_impressions?: number;
  total_active_time?: number;
  start_date?: number;
  end_date?: number;
};

export default function StaticAdPromptGenerator() {
  const [staticAdImage, setStaticAdImage] = useState<File | null>(null);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [copywriting, setCopywriting] = useState<string>('');
  const [guidelines, setGuidelines] = useState<string>('');
  const [copyLanguage, setCopyLanguage] = useState<string>('en');
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [staticAdPreview, setStaticAdPreview] = useState<string | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [costInfo, setCostInfo] = useState<any>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [imageGenMode, setImageGenMode] = useState<AdVisualMode | null>(null);
  const [imageSize, setImageSize] = useState<ImageSizeOption>('auto');
  const [referenceAdDimensions, setReferenceAdDimensions] = useState<{ width: number; height: number } | null>(null);

  const hasSupabase = isSupabaseConfigured();
  const [activeTab, setActiveTab] = useState<'new' | 'history' | 'edit' | 'support' | 'competitor-ads' | 'products'>('new');
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productsLoading, setProductsLoading] = useState(hasSupabase);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [detailProduct, setDetailProduct] = useState<ProductRecord | null>(null);
  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [creationsLoading, setCreationsLoading] = useState(false);
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pricingBilling, setPricingBilling] = useState<'monthly' | 'yearly'>('monthly');

  const [editSourceImage, setEditSourceImage] = useState<File | null>(null);
  const [editSourcePreview, setEditSourcePreview] = useState<string | null>(null);
  const [editInstructions, setEditInstructions] = useState<string>('');
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [competitorProductImage, setCompetitorProductImage] = useState<File | null>(null);
  const [competitorProductPreview, setCompetitorProductPreview] = useState<string | null>(null);
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [competitorCrawlSummary, setCompetitorCrawlSummary] = useState<string | null>(null);
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [competitorError, setCompetitorError] = useState<string | null>(null);
  const [competitorResults, setCompetitorResults] = useState<CompetitorAdItem[]>([]);
  const [competitorKeyword, setCompetitorKeyword] = useState<string | null>(null);
  const [competitorCached, setCompetitorCached] = useState(false);

  const handleStaticAdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setStaticAdImage(file);
      setReferenceAdDimensions(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setStaticAdPreview(dataUrl);
        const img = new Image();
        img.onload = () => {
          setReferenceAdDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedProductId(null);
      setProductImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setProductPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const loadProducts = useCallback(async () => {
    if (!hasSupabase) return;
    setProductsLoading(true);
    try {
      const res = await fetch('/api/products', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.products)) {
        setProducts(data.products);
      }
    } catch {
      // ignore
    } finally {
      setProductsLoading(false);
    }
  }, [hasSupabase]);

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null;

  const handleSelectProduct = (id: string) => {
    setSelectedProductId(id);
    setProductImage(null);
    const p = products.find((x) => x.id === id);
    if (p) setProductPreview(p.primary_image_url);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      if (selectedProductId === id) {
        setSelectedProductId(null);
        setProductPreview(null);
      }
    }
  };

  const handleEditSourceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditSourceImage(file);
    setEditError(null);
    setEditPrompt('');
    setEditedImageUrl(null);
    const reader = new FileReader();
    reader.onloadend = () => setEditSourcePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const isValidUrl = (string: string): boolean => {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  };

  const fetchCredits = useCallback(async () => {
    if (!hasSupabase) return;
    try {
      const subRes = await fetch('/api/subscription', { credentials: 'include' });
      if (subRes.ok) {
        const subData = await subRes.json();
        const credits = Number(subData?.credits_remaining ?? 0);
        if (Number.isFinite(credits)) setCreditsRemaining(credits);
      } else {
        setCreditsRemaining(0);
      }
    } catch {
      setCreditsRemaining(null);
    }
  }, [hasSupabase]);

  const gatePaidActionOrShowPricing = async (): Promise<boolean> => {
    if (!hasSupabase) return true;
    try {
      const subRes = await fetch('/api/subscription', { credentials: 'include' });
      if (subRes.status === 401) {
        window.location.href = '/login?next=/app';
        return false;
      }
      if (subRes.status === 404) {
        setShowPricingModal(true);
        return false;
      }
      const subData = await subRes.json();
      const credits = Number(subData?.credits_remaining ?? 0);
      if (!subRes.ok || !subData?.ok || !Number.isFinite(credits) || credits < 1) {
        setShowPricingModal(true);
        return false;
      }
      setCreditsRemaining(credits);
      return true;
    } catch {
      setShowPricingModal(true);
      return false;
    }
  };

  const handleGenerate = async () => {
    if (!staticAdImage || (!productImage && !selectedProductId)) {
      setError('Upload a reference ad and select or upload a product.');
      return;
    }
    const okToProceed = await gatePaidActionOrShowPricing();
    if (!okToProceed) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedPrompt('');
    setGeneratedImageUrl(null);
    setImageGenMode(null);

    try {
      const staticAdBase64 = await compressImageForApi(staticAdImage);
      const productBase64 = productImage ? await compressImageForApi(productImage) : null;

      const useSavedProduct = !!selectedProductId;
      const isUrl = !useSavedProduct && copywriting.trim() && isValidUrl(copywriting.trim());
      let copywritingInput = useSavedProduct ? null : copywriting || null;

      if (isUrl) {
        setIsScraping(true);
        try {
          const scrapeResponse = await fetch('/api/scrape-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: copywriting.trim() }),
          });
          const { data: scrapeData, errorMessage: scrapeErr } = await parseJsonResponse<{ summary?: string; branding?: unknown; markdown?: string; error?: string; details?: string }>(scrapeResponse);
          if (scrapeErr) {
            throw new Error(scrapeErr);
          }
          if (!scrapeResponse.ok || !scrapeData) {
            throw new Error(scrapeData?.error || scrapeData?.details || 'Failed to scrape URL.');
          }
          if (!scrapeData.summary || scrapeData.summary === 'No summary available') {
            throw new Error('Could not extract content from the URL. Please try another one or enter copy manually.');
          }
          copywritingInput = JSON.stringify({
            summary: scrapeData.summary,
            branding: scrapeData.branding || null,
            markdown: scrapeData.markdown || null,
          });
        } catch (scrapeError: any) {
          setError(`URL Error: ${scrapeError.message}`);
          setIsGenerating(false);
          setIsScraping(false);
          return;
        } finally {
          setIsScraping(false);
        }
      }

      const promptBody: Record<string, unknown> = {
        staticAdImage: staticAdBase64,
        copywriting: copywritingInput || null,
        isUrlScraped: isUrl,
        guidelines: guidelines.trim() || null,
        copyLanguage,
      };
      if (selectedProductId) {
        promptBody.productId = selectedProductId;
      } else {
        promptBody.productImage = productBase64;
      }

      const uploadPromise = productBase64
        ? fetch('/api/upload-product-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productImageBase64: productBase64 }),
          })
        : Promise.resolve(new Response(JSON.stringify({ url: selectedProduct?.primary_image_url }), { status: 200 }));

      const referenceUploadPromise = fetch('/api/upload-product-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productImageBase64: staticAdBase64 }),
      });

      const [response, uploadRes, referenceUploadRes] = await Promise.all([
        fetch('/api/generate-static-ad-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(promptBody),
        }),
        uploadPromise,
        referenceUploadPromise,
      ]);

      const { data: promptData, errorMessage: promptErr } = await parseJsonResponse<{
        prompt?: string;
        adVisualMode?: AdVisualMode;
        error?: string;
        cost?: unknown;
        matchedProductImageUrls?: string[];
      }>(response);
      if (promptErr) {
        throw new Error(promptErr);
      }
      const data = promptData!;

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to generate prompt.');
      }

      setGeneratedPrompt(data.prompt!);
      setCostInfo(data.cost ?? null);
      const adVisualMode: AdVisualMode =
        data.adVisualMode === 'realistic' ? 'realistic' : 'design';
      setImageGenMode(adVisualMode);

      const matchedUrls = data.matchedProductImageUrls?.filter((u) => u.startsWith('http')) ?? [];

      let productImageUrl: string | null = null;
      let productImageUrls: string[] = matchedUrls.length > 0 ? matchedUrls : [];
      const { data: uploadData } = await parseJsonResponse<{ url?: string }>(uploadRes);
      if (uploadRes.ok && uploadData?.url) {
        productImageUrl = uploadData.url;
        if (productImageUrls.length === 0) productImageUrls = [uploadData.url];
      } else if (selectedProduct && productImageUrls.length === 0) {
        productImageUrls = selectedProduct.images.map((i) => i.url);
        productImageUrl = selectedProduct.primary_image_url;
      }

      let referenceImageUrl: string | null = null;
      const { data: refUploadData } = await parseJsonResponse<{ url?: string }>(referenceUploadRes);
      if (referenceUploadRes.ok && refUploadData?.url) {
        referenceImageUrl = refUploadData.url;
      }

      setIsGeneratingImage(true);
      let creationId: string | null = null;
      if (hasSupabase) {
        try {
          const createRes = await fetch('/api/creations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              status: 'generating',
              aspect_ratio: getResolvedAspectRatio(),
              prompt: data.prompt,
            }),
          });
          const createData = await createRes.json();
          if (createRes.ok && createData?.id) creationId = createData.id;
        } catch {
          // continue without creationId; we'll save on success
        }
      }

      try {
        const imgRes = await fetch('/api/generate-ad-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: data.prompt,
            adVisualMode,
            ...(referenceImageUrl ? { referenceImageUrl } : { referenceImageBase64: staticAdBase64 }),
            ...(productImageUrls.length > 1
              ? { productImageUrls }
              : productImageUrl
                ? { productImageUrl }
                : productBase64
                  ? { productImageBase64: productBase64 }
                  : {}),
            aspectRatio: getResolvedAspectRatio(),
            ...(creationId ? { creationId } : {}),
          }),
        });
        const { data: imgData, errorMessage: imgErrMsg } = await parseJsonResponse<{ imageUrl?: string; error?: string; creationId?: string }>(imgRes);
        if (imgErrMsg) {
          setError(imgErrMsg);
          return;
        }
        if (imgRes.ok && imgData?.imageUrl) {
          setGeneratedImageUrl(imgData.imageUrl);
          if (creationId) {
            await loadCreations();
            await fetchCredits();
          } else {
            saveCreation(imgData.imageUrl, getResolvedAspectRatio(), data.prompt!);
          }
        } else if (!imgRes.ok) {
          if (imgRes.status === 401) {
            window.location.href = '/login?next=/app';
            return;
          }
          if (imgRes.status === 402 || imgRes.status === 404) {
            setError(null);
            setShowPricingModal(true);
            return;
          }
          setError(imgData?.error || 'Failed to generate image.');
        }
      } catch (imgErr: any) {
        setError(imgErr.message || 'Failed to generate image.');
      } finally {
        setIsGeneratingImage(false);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadImage = (imageUrl?: string, filename = 'generated-ad.jpg') => {
    const url = imageUrl ?? generatedImageUrl;
    if (!url) return;
    const downloadUrl = `/api/download-image?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getResolvedAspectRatio = useCallback((): string => {
    if (imageSize !== 'auto') return imageSize;
    if (!referenceAdDimensions) return '9:16';
    const { width: w, height: h } = referenceAdDimensions;
    const ratio = w / h;
    if (ratio < 0.85) return '9:16';
    if (ratio > 1.2) return '16:9';
    return '1:1';
  }, [imageSize, referenceAdDimensions]);

  const canGenerate = staticAdImage && (productImage || selectedProductId);

  const handleEditGenerate = async () => {
    if (!editSourceImage || !editSourcePreview) {
      setEditError('Please upload an ad image to edit.');
      return;
    }
    if (!editInstructions.trim()) {
      setEditError('Describe what you want to change.');
      return;
    }
    const okToProceed = await gatePaidActionOrShowPricing();
    if (!okToProceed) return;

    setIsEditing(true);
    setEditError(null);
    setEditPrompt('');
    setEditedImageUrl(null);

    try {
      const editImageBase64 = await compressImageForApi(editSourceImage);
      const promptRes = await fetch('/api/generate-edit-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: editImageBase64,
          instructions: editInstructions.trim(),
        }),
      });
      const { data: promptData, errorMessage: promptErr } = await parseJsonResponse<{ prompt?: string; error?: string }>(promptRes);
      if (promptErr) {
        throw new Error(promptErr);
      }
      if (!promptRes.ok || !promptData?.prompt) {
        throw new Error(promptData?.error || 'Failed to generate edit prompt.');
      }
      setEditPrompt(promptData.prompt);

      const editRes = await fetch('/api/edit-ad-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptData.prompt,
          imageBase64: editImageBase64,
          aspectRatio: 'auto',
        }),
      });
      const { data: editData, errorMessage: editErr } = await parseJsonResponse<{ imageUrl?: string; error?: string }>(editRes);
      if (editErr) {
        throw new Error(editErr);
      }
      if (editRes.ok && editData?.imageUrl) {
        setEditedImageUrl(editData.imageUrl);
        saveCreation(editData.imageUrl, 'auto', promptData.prompt!);
      } else {
        if (editRes.status === 401) {
          window.location.href = '/login?next=/app';
          return;
        }
        if (editRes.status === 402 || editRes.status === 404) {
          setShowPricingModal(true);
          return;
        }
        throw new Error(editData?.error || 'Failed to edit image.');
      }
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : 'Failed to edit image.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleCompetitorCrawl = async () => {
    const url = competitorUrl.trim();
    if (!url) {
      setCompetitorError('Enter a product page URL.');
      return;
    }
    try {
      new URL(url);
    } catch {
      setCompetitorError('Invalid URL.');
      return;
    }
    setCompetitorError(null);
    setCompetitorLoading(true);
    try {
      const res = await fetch('/api/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCompetitorError(data?.error || data?.details || 'Failed to load URL.');
        return;
      }
      setCompetitorCrawlSummary(data.summary ?? '');
      setCompetitorProductImage(null);
      setCompetitorProductPreview(null);
    } catch (e) {
      setCompetitorError(e instanceof Error ? e.message : 'Failed to load URL.');
    } finally {
      setCompetitorLoading(false);
    }
  };

  const handleCompetitorProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCompetitorProductImage(file);
      setCompetitorCrawlSummary(null);
      setCompetitorUrl('');
      const reader = new FileReader();
      reader.onloadend = () => setCompetitorProductPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCloneFromCompetitorAd = async (imageUrl: string) => {
    try {
      const proxyUrl = `/api/download-image?url=${encodeURIComponent(imageUrl)}&filename=reference-ad.jpg`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error('Could not load image');
      const blob = await res.blob();
      const file = new File([blob], 'reference-ad.jpg', { type: blob.type || 'image/jpeg' });
      setStaticAdImage(file);
      setReferenceAdDimensions(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setStaticAdPreview(dataUrl);
        const img = new Image();
        img.onload = () => setReferenceAdDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        img.src = dataUrl;
      };
      reader.readAsDataURL(blob);
      setActiveTab('new');
      setSidebarOpen(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ad image for Clone.');
    }
  };

  const handleCompetitorSearch = async () => {
    if (!competitorProductImage && !competitorCrawlSummary) {
      setCompetitorError('Upload a product image or paste a URL and load its summary first.');
      return;
    }
    setCompetitorError(null);
    setCompetitorLoading(true);
    setCompetitorResults([]);
    setCompetitorKeyword(null);
    try {
      const body: { productImageBase64?: string; crawlSummary?: string } = {};
      if (competitorProductImage) {
        body.productImageBase64 = await compressImageForApi(competitorProductImage);
      } else if (competitorCrawlSummary) {
        body.crawlSummary = competitorCrawlSummary;
      }
      const res = await fetch('/api/competitor-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setCompetitorError(data?.error || data?.details || 'Search failed.');
        return;
      }
      const list = Array.isArray(data.results) ? data.results : [];
      setCompetitorResults(list as CompetitorAdItem[]);
      setCompetitorKeyword(data.keyword ?? null);
      setCompetitorCached(Boolean(data.cached));
    } catch (e) {
      setCompetitorError(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setCompetitorLoading(false);
    }
  };

  const loadCreations = useCallback(async () => {
    if (!hasSupabase) return;
    setCreationsLoading(true);
    try {
      const res = await fetch('/api/creations', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.creations)) setCreations(data.creations);
    } catch {
      // ignore
    } finally {
      setCreationsLoading(false);
    }
  }, [hasSupabase]);

  useEffect(() => {
    if (!hasSupabase) return;
    loadCreations();
  }, [hasSupabase, loadCreations]);

  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u?.email) setUser({ email: u.email, name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email.split('@')[0] });
    });
  }, []);

  useEffect(() => {
    if (hasSupabase) fetchCredits();
  }, [hasSupabase, fetchCredits]);

  useEffect(() => {
    if (hasSupabase) loadProducts();
  }, [hasSupabase, loadProducts]);

  useEffect(() => {
    if (hasSupabase && activeTab === 'products') loadProducts();
  }, [activeTab, hasSupabase, loadProducts]);

  useEffect(() => {
    if (hasSupabase && activeTab === 'history') loadCreations();
  }, [activeTab, hasSupabase, loadCreations]);

  const hasGenerating = creations.some((c) => c.status === 'generating' || !c.image_url);
  useEffect(() => {
    if (!hasSupabase || activeTab !== 'history' || !hasGenerating) return;
    const interval = setInterval(loadCreations, 8000);
    return () => clearInterval(interval);
  }, [hasSupabase, activeTab, hasGenerating, loadCreations]);

  const saveCreation = useCallback(
    async (imageUrl: string, aspectRatio: string, prompt: string) => {
      if (!hasSupabase) return;
      try {
        await fetch('/api/creations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ image_url: imageUrl, aspect_ratio: aspectRatio, prompt }),
        });
        await loadCreations();
        await fetchCredits();
      } catch {
        // ignore
      }
    },
    [hasSupabase, loadCreations, fetchCredits]
  );

  const handleSignOut = async () => {
    try {
      const supabase = createSupabaseClient();
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch {
      window.location.href = '/';
    }
  };

  return (
    <>
      <PricingModal
        open={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        billing={pricingBilling}
        onBillingChange={setPricingBilling}
      />

      <DashboardShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sidebarOpen={sidebarOpen}
        onSidebarOpen={setSidebarOpen}
        creditsRemaining={creditsRemaining}
        user={user}
        onUpgrade={() => setShowPricingModal(true)}
        onSignOut={handleSignOut}
      >
          {activeTab === 'history' && hasSupabase ? (
          <div className="dash-card dash-card-lg">
            <h2 className="dash-section-title mb-6">Your creations</h2>
            {creationsLoading ? (
              <div className="flex items-center justify-center py-12"><svg className="h-8 w-8 dash-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>
            ) : creations.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">No creations yet. Generate an image in Clone.</p>
            ) : (
              <div className="dash-grid-media">
                {creations.map((c) => {
                  const isGenerating = c.status === 'generating' || !c.image_url;
                  return (
                    <div key={c.id} className="dash-media-card">
                      {isGenerating ? (
                        <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 bg-slate-100 p-4">
                          <svg className="h-6 w-6 dash-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          <span className="text-xs font-medium text-slate-600">Generating...</span>
                        </div>
                      ) : (
                        <a href={c.image_url!} target="_blank" rel="noopener noreferrer" className="block aspect-[9/16] w-full bg-slate-100"><img src={c.image_url!} alt="" className="h-full w-full object-cover" /></a>
                      )}
                      <div className="flex items-center justify-between gap-2 p-2 sm:p-3">
                        <span className="truncate text-[10px] sm:text-xs text-slate-500">{c.aspect_ratio || '—'} · {new Date(c.created_at).toLocaleDateString()}</span>
                        {!isGenerating && (
                          <div className="flex shrink-0 gap-1">
                            <a href={c.image_url!} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50" title="Open"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>
                            <button type="button" onClick={() => handleDownloadImage(c.image_url!, 'generated-ad.jpg')} className="dash-btn dash-btn-primary !px-2 !py-1.5" title="Download"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          ) : activeTab === 'edit' ? (
        <>
          <header className="dash-animate-in mb-8">
            <h1 className="dash-title">Edit a generated ad</h1>
            <p className="dash-subtitle mt-2">Upload an existing ad and describe changes. We&apos;ll generate an edit prompt and render the updated creative.</p>
          </header>

          <div className="dash-workspace">
            <div className="flex flex-col gap-4 sm:gap-5 dash-workspace-form">
              <section className="space-y-4 dash-card">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="dash-section-title">1. Upload your ad</h2>
                  <span className="dash-badge dash-badge-required shrink-0">REQUIRED</span>
                </div>
                <input type="file" accept="image/*" onChange={handleEditSourceUpload} className="hidden" id="edit-source-upload" />
                <label htmlFor="edit-source-upload" className="dash-upload group">
                  {editSourcePreview ? (
                    <div className="absolute inset-0 h-full w-full p-2"><img src={editSourcePreview} alt="Ad to edit" className="h-full w-full rounded-xl object-cover shadow-sm" /><div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"><span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-800 backdrop-blur-sm">Change</span></div></div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center p-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white ring-1 ring-slate-200"><svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>
                      <div><p className="text-sm font-medium text-slate-700">Upload ad image</p><p className="mt-0.5 text-xs text-slate-500">PNG/JPG recommended</p></div>
                    </div>
                  )}
                </label>
              </section>
              <section className="space-y-4 dash-card">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="dash-section-title">2. What should change?</h2>
                  <span className="dash-badge dash-badge-optional shrink-0">REQUIRED</span>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Edit instructions</label>
                  <textarea value={editInstructions} onChange={(e) => setEditInstructions(e.target.value)} placeholder="Example: Replace the headline with &quot;Buy 2 Get 1 Free&quot;, change the background to a soft gradient, keep the product size and position the same." rows={4} className="dash-input dash-textarea min-h-[104px]" />
                </div>
              </section>
              <div className="dash-card">
                <button type="button" onClick={handleEditGenerate} disabled={!editSourceImage || !editInstructions.trim() || isEditing} className="dash-btn dash-btn-primary w-full min-h-[52px] touch-manipulation">
                  {isEditing ? (<><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /><span>Editing…</span></>) : (<><span>Generate edit</span><svg className="h-4 w-4 text-white/90 transition-transform group-hover:translate-x-0.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></>)}
                </button>
                {editError && <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>{editError}</p></div>}
              </div>
            </div>
            <div className="dash-workspace-preview dash-sticky-preview">
              <div className="dash-preview-panel flex min-h-[280px] sm:min-h-[380px] lg:min-h-[480px]">
                <div className="dash-preview-panel-header">
                  <span className="dash-preview-panel-label">Edited output</span>
                  {editedImageUrl && <a href={editedImageUrl} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn-secondary !px-3 !py-2 text-xs min-h-[40px] items-center"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Open</a>}
                </div>
                <div className="dash-preview-panel-body">
                  {!editedImageUrl && !isEditing ? (
                    <div className="flex flex-col items-center justify-center text-center px-2">
                      <div className="mb-3 sm:mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50"><svg className="h-7 w-7 sm:h-8 sm:w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg></div>
                      <h3 className="text-sm font-semibold text-slate-800">Your edited ad will appear here</h3>
                      <p className="mt-1 max-w-[360px] text-xs text-slate-500">Upload an ad, describe changes, then click Generate edit.</p>
                    </div>
                  ) : isEditing ? (
                    <div className="flex flex-col items-center justify-center text-center px-2">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50"><svg className="h-7 w-7 dash-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg></div>
                      <p className="text-sm font-medium text-slate-700">Editing your ad…</p>
                      <p className="dash-muted-text mt-1">Generating edit prompt + rendering with GPT Image 2</p>
                      <p className="mt-3 max-w-[280px] text-xs text-slate-500">Takes around 90 seconds. You can switch tabs or lock your phone – generation continues in the background.</p>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full max-w-lg rounded-xl overflow-hidden bg-slate-50 ring-1 ring-slate-200"><a href={editedImageUrl!} target="_blank" rel="noopener noreferrer" className="block"><img src={editedImageUrl!} alt="Edited ad" className="w-full h-auto object-contain" /></a></div>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                        <a href={editedImageUrl!} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn-secondary text-xs min-h-[44px]"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Open</a>
                        <button type="button" onClick={() => handleDownloadImage(editedImageUrl!, 'edited-ad.jpg')} className="inline-flex items-center gap-1.5 dash-btn dash-btn-primary text-xs min-h-[44px] touch-manipulation"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {editPrompt && <div className="mt-4 dash-card"><h3 className="text-sm font-semibold text-slate-900">Generated edit prompt</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{editPrompt}</p></div>}
            </div>
          </div>
        </>
          ) : activeTab === 'competitor-ads' ? (
        <div className="space-y-6">
          <header className="dash-animate-in">
            <h1 className="dash-title">Competitor Ads</h1>
            <p className="dash-subtitle mt-2">Find Facebook/Instagram ads in your product category. Upload a product image or paste a product page URL.</p>
          </header>
          <div className="dash-card dash-card-lg">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Product input</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Upload product image</p>
                <input type="file" accept="image/*" onChange={handleCompetitorProductUpload} className="hidden" id="competitor-product-upload" />
                <label htmlFor="competitor-product-upload" className="dash-upload">
                  {competitorProductPreview ? (
                    <img src={competitorProductPreview} alt="Product" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm text-slate-500">Choose image</span>
                  )}
                </label>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Or paste product page URL</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={competitorUrl}
                    onChange={(e) => setCompetitorUrl(e.target.value)}
                    placeholder="https://..."
                    className="dash-input flex-1"
                  />
                  <button type="button" onClick={handleCompetitorCrawl} disabled={competitorLoading || !competitorUrl.trim()} className="shrink-0 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-50">Load</button>
                </div>
                {competitorCrawlSummary && <p className="mt-2 text-xs text-slate-500">Summary loaded ({competitorCrawlSummary.length} chars)</p>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={handleCompetitorSearch} disabled={competitorLoading || (!competitorProductImage && !competitorCrawlSummary)} className="dash-btn dash-btn-primary disabled:opacity-50">
                {competitorLoading ? <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : null}
                Search competitor ads
              </button>
              {competitorKeyword && <span className="text-sm text-slate-500">Keyword: <strong>{competitorKeyword}</strong>{competitorCached ? ' (cached)' : ''}</span>}
            </div>
            {competitorError && <p className="mt-3 text-sm text-red-600">{competitorError}</p>}
          </div>
          {competitorKeyword != null && (
            <div className="dash-card dash-card-lg">
              <h2 className="mb-4 text-base font-semibold text-slate-900">Results (by total impressions)</h2>
              {competitorResults.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {competitorResults.map((ad, i) => {
                  const imgUrl = ad.snapshot?.images?.[0]?.resized_image_url || ad.snapshot?.images?.[0]?.original_image_url;
                  const bodyText = ad.snapshot?.body?.text?.slice(0, 120);
                  return (
                    <div key={ad.ad_archive_id ?? i} className="dash-media-card">
                      {imgUrl ? <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="block aspect-[9/16] w-full bg-slate-100"><img src={imgUrl} alt="" className="h-full w-full object-cover" /></a> : <div className="aspect-[9/16] w-full bg-slate-100" />}
                      <div className="p-2 sm:p-3 space-y-2">
                        <p className="truncate text-xs font-medium text-slate-900">{ad.page_name || '—'}</p>
                        {bodyText && <p className="line-clamp-2 text-[10px] text-slate-500">{bodyText}…</p>}
                        {(ad.total_impressions != null || ad.total_active_time != null) && <p className="text-[10px] text-slate-400">{ad.total_impressions != null ? `${ad.total_impressions.toLocaleString()} impr.` : ''} {ad.total_active_time != null ? ` · ${Math.round(ad.total_active_time / 86400)}d active` : ''}</p>}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {imgUrl && (
                            <>
                              <button type="button" onClick={() => handleDownloadImage(imgUrl, 'competitor-ad.jpg')} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50" title="Download">Download</button>
                              <button type="button" onClick={() => handleCloneFromCompetitorAd(imgUrl)} className="inline-flex items-center gap-1 dash-btn dash-btn-primary !px-2 !py-1.5 text-[10px]" title="Use as reference in Clone">Clone</button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">No ads found for keyword &quot;{competitorKeyword}&quot; in the last 3 months. Try another product image or URL, or a broader category.</p>
              )}
            </div>
          )}
        </div>
          ) : activeTab === 'products' ? (
        <div className="space-y-6">
          <header className="dash-animate-in flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="dash-title">Products</h1>
              <div className="dash-title-accent" aria-hidden />
              <p className="dash-subtitle mt-3">Add your brand products once. Clone ads will use their images, copy, and branding automatically.</p>
            </div>
            <button type="button" onClick={() => setShowProductModal(true)} className="dash-btn dash-btn-primary shrink-0">
              + Add product
            </button>
          </header>
          {productsLoading ? (
            <p className="text-sm text-slate-500">Loading products…</p>
          ) : products.length === 0 ? (
            <div className="dash-empty dash-card border-dashed">
              <p className="dash-empty-title">No products yet</p>
              <p className="dash-empty-desc">Add a product from its store URL or enter details manually with up to 3 photos.</p>
              <button type="button" onClick={() => setShowProductModal(true)} className="dash-btn dash-btn-primary mt-4">Add your first product</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <div key={p.id} className="dash-product-card">
                  <button type="button" onClick={() => setDetailProduct(p)} className="block w-full text-left">
                    <div className="aspect-square bg-slate-50">
                      <img src={p.primary_image_url} alt={p.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-4 space-y-2">
                      <h3 className="font-semibold text-slate-900 truncate">{p.name}</h3>
                      <p className="text-xs text-slate-500">{p.source === 'url' ? 'From URL' : 'Manual'} · {p.images.length} image{p.images.length !== 1 ? 's' : ''}</p>
                      {(p.scrape_cache?.priceDisplay || p.scrape_cache?.extractedPricing?.salePrice) && (
                        <p className="text-xs font-medium text-sky-700">Price: {p.scrape_cache?.priceDisplay ?? p.scrape_cache?.extractedPricing?.salePrice}</p>
                      )}
                      <p className="text-[10px] text-sky-600">Tap to view & edit scraped data →</p>
                    </div>
                  </button>
                  <div className="px-4 pb-4 flex gap-2">
                    <button type="button" onClick={() => { handleSelectProduct(p.id); setActiveTab('new'); }} className="dash-btn dash-btn-primary flex-1 !py-2 text-xs">Use in Clone</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
          ) : activeTab === 'support' ? (
        <div className="dash-card dash-card-lg max-w-2xl">
          <h1 className="dash-title">Support</h1>
          <p className="dash-subtitle mt-3 leading-relaxed">
            Need help with an issue, custom deals for more credits, or anything else? We’re here for you.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>• Help with technical problems or bugs</li>
            <li>• Custom credit packs and bulk pricing</li>
            <li>• Feature requests or feedback</li>
          </ul>
          <a
            href="https://t.me/dlnkko"
            target="_blank"
            rel="noopener noreferrer"
            className="dash-btn dash-btn-primary mt-6"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            Chat with Founder
          </a>
        </div>
          ) : (
        <>
          {/* Clone section header */}
          <header className="dash-animate-in mb-8 max-w-2xl">
            <h1 className="dash-title">Clone any static ad with your product</h1>
            <div className="dash-title-accent" aria-hidden />
            <p className="dash-subtitle mt-3">Upload a reference ad and pick a saved product (or upload a one-off image).</p>
            {hasSupabase && products.length === 0 && !productsLoading && (
              <div className="dash-alert dash-alert-info mt-4">
                <strong>Start here:</strong> add a product in{' '}
                <button type="button" className="font-semibold text-indigo-600 underline" onClick={() => setActiveTab('products')}>Products</button>
                {' '}so we can match packaging, product shots, and branding when cloning ads.
              </div>
            )}
          </header>

        <div className="dash-workspace">
          <div className="flex flex-col gap-4 sm:gap-5 dash-workspace-form">
            <section className="space-y-4 dash-card">
              <div className="flex items-center justify-between gap-2">
                <h2 className="dash-section-title">1. Visual assets</h2>
                <span className="dash-badge dash-badge-required shrink-0">REQUIRED</span>
              </div>
              <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 sm:gap-4">
                <div className="dash-upload-slot">
                  <p className="dash-label mb-1">Reference ad</p>
                  <input type="file" accept="image/*" onChange={handleStaticAdUpload} className="hidden" id="static-ad-upload" />
                  <label htmlFor="static-ad-upload" className="dash-upload group">
                    {staticAdPreview ? (
                      <div className="absolute inset-0 h-full w-full p-2"><img src={staticAdPreview} alt="Reference Ad" className="h-full w-full rounded-lg object-cover shadow-sm" /><div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"><span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[var(--dash-fg)] backdrop-blur-sm">Change</span></div></div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 sm:gap-3 text-center p-2 sm:p-4">
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-[var(--dash-border)] bg-white shadow-sm"><svg className="h-5 w-5 text-[var(--brand-indigo)]" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>
                        <div><p className="text-xs sm:text-sm font-medium text-[var(--dash-fg)]">Reference ad</p><p className="dash-muted-text mt-0.5">Style to copy</p></div>
                      </div>
                    )}
                  </label>
                </div>
                <div className="dash-upload-slot">
                  {products.length > 0 && (
                    <>
                      <label className="dash-label mb-1" htmlFor="product-select">Product source</label>
                      <select
                        id="product-select"
                        value={selectedProductId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) handleSelectProduct(v);
                          else {
                            setSelectedProductId(null);
                            setProductPreview(null);
                          }
                        }}
                        className="dash-select text-xs sm:text-sm"
                      >
                        <option value="">One-off upload</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleProductUpload} className="hidden" id="product-upload" disabled={!!selectedProductId} />
                  <label htmlFor="product-upload" className={`dash-upload group mt-1 ${selectedProductId ? 'opacity-90 cursor-default' : ''}`}>
                    {productPreview ? (
                      <div className="absolute inset-0 h-full w-full p-2"><img src={productPreview} alt="Your Product" className="h-full w-full rounded-lg object-cover shadow-sm" />{!selectedProductId && <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"><span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[var(--dash-fg)] backdrop-blur-sm">Change</span></div>}</div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 sm:gap-3 text-center p-2 sm:p-4">
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-[var(--dash-border)] bg-white shadow-sm"><svg className="h-5 w-5 text-[var(--brand-indigo)]" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></div>
                        <div><p className="text-xs sm:text-sm font-medium text-[var(--dash-fg)]">Your product</p><p className="dash-muted-text mt-0.5">Select above or upload</p></div>
                      </div>
                    )}
                  </label>
                  {selectedProduct && <p className="dash-muted-text text-center text-[var(--brand-indigo)]">{selectedProduct.images.length} stored images</p>}
                </div>
              </div>
              <div className="pt-4 border-t border-[var(--dash-border)]">
                <label className="dash-label mb-2">Output size</label>
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value as ImageSizeOption)}
                  className="dash-input min-h-[44px]"
                >
                  {ASPECT_RATIO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.value === 'auto' && referenceAdDimensions ? `Auto (${referenceAdDimensions.width}×${referenceAdDimensions.height})` : opt.label}
                    </option>
                  ))}
                </select>
                <p className="dash-muted-text mt-1.5">{imageSize === 'auto' && referenceAdDimensions ? `Using aspect ratio from reference ad (${getResolvedAspectRatio()}).` : imageSize === 'auto' ? 'Match reference ad proportions (vertical by default).' : `Fixed aspect ratio: ${imageSize}.`}</p>
              </div>
            </section>
            <section className="space-y-4 dash-card">
              <div className="flex items-center justify-between gap-2"><h2 className="dash-section-title">2. Context</h2><span className="dash-badge dash-badge-optional shrink-0">OPTIONAL</span></div>
              <div className="space-y-4">
                <div>
                  <label className="dash-label mb-1.5">Ad copy language</label>
                  <select
                    value={copyLanguage}
                    onChange={(e) => setCopyLanguage(e.target.value)}
                    className="dash-select"
                  >
                    {COPY_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                  <p className="dash-muted-text mt-1.5">Headlines and text on the generated ad will be written in this language.</p>
                </div>
                {!selectedProductId && (
                <div>
                  <label className="dash-label mb-1.5">Product URL (one-off, optional)</label>
                  <div className="dash-link-input-wrap">
                    <input type="url" value={copywriting} onChange={(e) => setCopywriting(e.target.value)} placeholder="https://your-store.com/product" className="dash-input min-h-[48px]" />
                    <svg className="dash-link-input-icon h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  </div>
                  {copywriting.trim() && isValidUrl(copywriting.trim()) && <p className="mt-2 text-xs font-medium text-[var(--brand-indigo)]">Page will be scraped for copy & branding</p>}
                </div>
                )}
                {selectedProduct && <p className="dash-muted-text text-sm">Using saved product copy & branding from Products.</p>}
                <div>
                  <label className="dash-label mb-1.5">Creative guidelines</label>
                  <textarea value={guidelines} onChange={(e) => setGuidelines(e.target.value)} placeholder="e.g., Change the background to a sunny beach, remove all text overlays, make it moody..." rows={3} className="dash-input dash-textarea min-h-[88px]" />
                </div>
              </div>
            </section>
            <div className="dash-card">
              <button type="button" onClick={handleGenerate} disabled={!canGenerate || isGenerating} className="dash-btn dash-btn-primary w-full min-h-[52px] touch-manipulation">
                {isGenerating ? <><svg className="h-4 w-4 animate-spin text-white/90" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>{isScraping ? 'Analyzing URL...' : 'Generating Image...'}</span></> : <><span>Generate Image</span><svg className="h-4 w-4 text-white/90 transition-transform group-hover:translate-x-0.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></>}
              </button>
              {error && <div className="dash-alert dash-alert-error mt-4"><svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>{error}</p></div>}
            </div>
          </div>
          <div className="dash-workspace-preview dash-sticky-preview">
            <div className="dash-preview-panel flex min-h-[280px] sm:min-h-[380px] lg:min-h-[480px]">
              <div className="dash-preview-panel-header">
                <span className="dash-preview-panel-label">Generated image</span>
                {generatedImageUrl && <a href={generatedImageUrl} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn-secondary !px-3 !py-2 text-xs min-h-[40px] items-center"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Open</a>}
              </div>
              <div className="dash-preview-panel-body min-h-[240px] sm:min-h-[320px] lg:min-h-[380px]">
                {!generatedImageUrl && !isGenerating && !isGeneratingImage ? (
                  <div className="flex flex-col items-center justify-center text-center px-2">
                    <div className="mb-3 sm:mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50"><svg className="h-7 w-7 sm:h-8 sm:w-8 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>
                    <h3 className="text-sm font-semibold text-slate-800">Your ad will appear here</h3>
                    <p className="mt-1 max-w-[260px] text-xs text-slate-500">Upload both images and tap Generate Image.</p>
                  </div>
                ) : (isGenerating || isGeneratingImage) ? (
                  <div className="flex flex-col items-center justify-center text-center px-2">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50"><svg className="h-7 w-7 dash-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg></div>
                    <p className="text-sm font-medium text-slate-700">Generating your ad…</p>
                    <p className="dash-muted-text mt-1">
                      {isGeneratingImage
                        ? imageGenMode
                          ? `Rendering — ${adVisualModeLabel(imageGenMode)}`
                          : 'Rendering your ad…'
                        : 'Analyzing reference & building prompt…'}
                    </p>
                    <p className="mt-3 max-w-[280px] text-xs text-slate-500">Takes around 90 seconds. You can switch tabs, lock your phone, or leave the app – generation continues in the background.</p>
                  </div>
                ) : generatedImageUrl ? (
                  <div className="w-full flex flex-col items-center">
                    <div className="w-full max-w-lg rounded-xl overflow-hidden bg-slate-50 ring-1 ring-slate-200">
                      <a href={generatedImageUrl} target="_blank" rel="noopener noreferrer" className="block"><img src={generatedImageUrl} alt="Generated ad" className="w-full h-auto object-contain" /></a>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                      <a href={generatedImageUrl} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn-secondary text-xs min-h-[44px]"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Open</a>
                      <button type="button" onClick={() => handleDownloadImage(generatedImageUrl, 'generated-ad.jpg')} className="inline-flex items-center gap-1.5 dash-btn dash-btn-primary text-xs min-h-[44px] touch-manipulation"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </DashboardShell>

      <ProductModal
        open={showProductModal}
        onClose={() => setShowProductModal(false)}
        onCreated={(p) => {
          setProducts((prev) => [p, ...prev]);
          handleSelectProduct(p.id);
        }}
      />
      <ProductDetailPanel
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        onSaved={(p) => {
          setProducts((prev) => prev.map((x) => (x.id === p.id ? p : x)));
          setDetailProduct(p);
          if (selectedProductId === p.id) setProductPreview(p.primary_image_url);
        }}
        onDeleted={(id) => {
          setProducts((prev) => prev.filter((x) => x.id !== id));
          setDetailProduct(null);
        }}
      />
    </>
  );
}
