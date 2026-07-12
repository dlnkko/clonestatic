'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { createClient as createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { DashboardShell } from '../components/dashboard/DashboardShell';
import { AdPreviewLoading } from '../components/dashboard/AdPreviewLoading';
import { PricingModal } from '../components/dashboard/PricingModal';
import { OnboardingWelcome } from '../components/OnboardingWelcome';
import { DashCombobox } from '../components/dashboard/DashCombobox';
import { ProductSourcePicker } from '../components/dashboard/ProductSourcePicker';
import { ProductDetailPanel } from '../components/ProductDetailPanel';
import { ProductModal } from '../components/ProductModal';
import { AppProviders } from './providers';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import { formatMaxProductsLabel, isEntitledPlan, isPaidPlan } from '@/lib/plans';
import { CopyLanguagePicker } from '../components/dashboard/CopyLanguagePicker';
import type { ProductRecord } from '@/lib/products/types';
import type { AdVisualMode } from '@/lib/ad-visual-mode';
import {
  prefetchCreationImages,
  readCreationsCache,
  writeCreationsCache,
} from '@/lib/creations/client-cache';
import {
  clearPendingImageJob,
  readPendingImageJob,
  setPendingImageJob,
} from '@/lib/creations/pending-generation';
import { isTransientFetchError } from '@/lib/display-image-url';
import { ProxiedImage } from '../components/ProxiedImage';
import { StepHeader } from '../components/dashboard/StepHeader';
import { TeamMembersPanel } from '../components/dashboard/TeamMembersPanel';

/** Parse response as JSON; if body is not JSON (e.g. "Request Entity Too Large"), return null and set friendly error. */
async function createGeneratingCreation(
  aspectRatio: string,
  prompt: string,
  referenceImageUrl?: string | null,
  retries = 3
): Promise<string | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const createRes = await fetch('/api/creations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'generating',
          aspect_ratio: aspectRatio,
          prompt,
          reference_image_url: referenceImageUrl ?? null,
        }),
      });
      const createData = await createRes.json();
      if (createRes.ok && createData?.id) return createData.id as string;
    } catch {
      // retry
    }
    if (attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }
  return null;
}

async function parseJsonResponse<T = unknown>(res: Response): Promise<{ data: T | null; errorMessage: string | null }> {
  const text = await res.text();
  try {
    const data = (text ? JSON.parse(text) : {}) as T;
    return { data, errorMessage: null };
  } catch {
    if (res.status === 413) {
      return { data: null, errorMessage: 'Request too large. Please try again.' };
    }
    if (res.status === 504 || res.status === 408) {
      return { data: null, errorMessage: 'Request timed out. Keep the screen on and try again.' };
    }
    if (res.status >= 500) {
      return { data: null, errorMessage: 'Server error. Please try again in a moment.' };
    }
    if (text.startsWith('<') || text.includes('<!DOCTYPE')) {
      return { data: null, errorMessage: 'Server timeout. Keep the screen on and try again.' };
    }
    return { data: null, errorMessage: text?.slice(0, 200) || 'Invalid response from server. Please try again.' };
  }
}

const MAX_IMAGE_BYTES = 280000; // tighter on mobile networks; ~375KB base64 per image

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/** Compress image to JPEG data URL under maxSizeBytes (blob size). */
function compressImageForApi(file: File, maxSizeBytes: number = MAX_IMAGE_BYTES): Promise<string> {
  const maxDim = isMobileDevice() ? 1280 : 1920;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDimLocal = maxDim;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxDimLocal || h > maxDimLocal) {
        if (w > h) {
          h = Math.round((h * maxDimLocal) / w);
          w = maxDimLocal;
        } else {
          w = Math.round((w * maxDimLocal) / h);
          h = maxDimLocal;
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
      if (file.size <= maxSizeBytes * 1.2) {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Invalid image. Try JPG or PNG.'));
        reader.readAsDataURL(file);
        return;
      }
      reject(new Error('Invalid image. Try JPG or PNG.'));
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
  status?: 'generating' | 'completed' | 'failed';
  error_message?: string | null;
  reference_image_url?: string | null;
};

export type LibraryAdCard = {
  id: string;
  adArchiveId: string;
  imageUrl: string;
  pageName: string | null;
  bodyPreview: string | null;
  category: string;
  source: string;
  seedLabel: string;
  scrapedAt: string;
  totalImpressions: number | null;
};

export type LibraryBrandCard = {
  brandName: string;
  adCount: number;
  maxImpressions: number | null;
};

export type LibraryPeriod = {
  start_date: string;
  end_date: string;
  label: string;
};

const ONBOARDING_STORAGE = 'admirror_onboarding_dismissed';
const LAST_PLAN_STORAGE = 'admirror_last_plan';

function subscriptionPlanRank(plan: string | null | undefined): number {
  switch (plan) {
    case 'owner':
      return 99;
    case 'scale':
      return 3;
    case 'pro':
      return 2;
    case 'standard':
      return 1;
    default:
      return 0;
  }
}

function StaticAdAppPage() {
  const { t } = useI18n();
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
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [imageSize, setImageSize] = useState<ImageSizeOption>('auto');
  const [referenceAdDimensions, setReferenceAdDimensions] = useState<{ width: number; height: number } | null>(null);

  const hasSupabase = isSupabaseConfigured();
  const [activeTab, setActiveTab] = useState<'new' | 'history' | 'support' | 'ad-library' | 'products' | 'team'>('new');
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productsLoading, setProductsLoading] = useState(hasSupabase);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [refreshProductPage, setRefreshProductPage] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [detailProduct, setDetailProduct] = useState<ProductRecord | null>(null);
  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [creationsLoading, setCreationsLoading] = useState(false);
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<{ url: string; title: string } | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [pendingPreviewCreationId, setPendingPreviewCreationId] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [maxProducts, setMaxProducts] = useState<number | null>(null);
  const [canAddProduct, setCanAddProduct] = useState(true);
  const [canCancelSubscription, setCanCancelSubscription] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [teamOwnerEmail, setTeamOwnerEmail] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pricingBilling, setPricingBilling] = useState<'monthly' | 'yearly'>('monthly');

  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryLoadingMore, setLibraryLoadingMore] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryAds, setLibraryAds] = useState<LibraryAdCard[]>([]);
  const [libraryCategories, setLibraryCategories] = useState<string[]>([]);
  const [libraryCategory, setLibraryCategory] = useState<string>('all');
  const [librarySelectedBrand, setLibrarySelectedBrand] = useState<string | null>(null);
  const [libraryBrands, setLibraryBrands] = useState<LibraryBrandCard[]>([]);
  const [libraryBrandFilter, setLibraryBrandFilter] = useState('');
  const [libraryKeywordSearch, setLibraryKeywordSearch] = useState('');
  const [libraryKeywordMode, setLibraryKeywordMode] = useState(false);
  const [libraryBrowseMode, setLibraryBrowseMode] = useState<'all_ads' | 'brands'>('all_ads');
  const [libraryPeriod, setLibraryPeriod] = useState<LibraryPeriod | null>(null);
  const [libraryTotalCount, setLibraryTotalCount] = useState(0);
  const [libraryMetaLoaded, setLibraryMetaLoaded] = useState(false);
  const [libraryFilteredCount, setLibraryFilteredCount] = useState<number | null>(null);
  const [libraryNextCursor, setLibraryNextCursor] = useState<string | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [libraryLastRun, setLibraryLastRun] = useState<{
    status: string;
    creditsUsed: number;
    adsInserted: number;
    finishedAt: string | null;
  } | null>(null);

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
      void fetchSubscription();
    }
  };

  const isValidUrl = (string: string): boolean => {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  };

  const fetchSubscription = useCallback(async () => {
    if (!hasSupabase) return;
    try {
      const subRes = await fetch('/api/subscription', { credentials: 'include' });
      if (subRes.ok) {
        const subData = await subRes.json();
        const credits = Number(subData?.credits_remaining ?? 0);
        if (Number.isFinite(credits)) setCreditsRemaining(credits);
        setPlanName(typeof subData?.plan_name === 'string' ? subData.plan_name : null);
        setCurrentPlan(typeof subData?.plan === 'string' ? subData.plan : null);
        setProductCount(typeof subData?.product_count === 'number' ? subData.product_count : null);
        setMaxProducts(typeof subData?.max_products === 'number' ? subData.max_products : null);
        setCanAddProduct(subData?.can_add_product !== false);
        setCancelAtPeriodEnd(subData?.cancel_at_period_end === true);
        setIsTeamMember(subData?.is_team_member === true);
        setTeamOwnerEmail(
          typeof subData?.team_owner_email === 'string' ? subData.team_owner_email : null
        );
        setCanCancelSubscription(
          !subData?.is_team_member &&
            isPaidPlan(subData?.plan) &&
            subData?.has_whop_membership === true
        );
      } else {
        setCreditsRemaining(0);
        setPlanName(null);
        setProductCount(null);
        setMaxProducts(null);
        setCanAddProduct(true);
        setCanCancelSubscription(false);
        setCancelAtPeriodEnd(false);
        setIsTeamMember(false);
        setTeamOwnerEmail(null);
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
      setPlanName(typeof subData?.plan_name === 'string' ? subData.plan_name : null);
      setProductCount(typeof subData?.product_count === 'number' ? subData.product_count : null);
      setMaxProducts(typeof subData?.max_products === 'number' ? subData.max_products : null);
      setCanAddProduct(subData?.can_add_product !== false);
      return true;
    } catch {
      setShowPricingModal(true);
      return false;
    }
  };

  const handleGenerate = async () => {
    if (!staticAdImage || !selectedProductId) {
      setError('Upload a reference ad and select a saved product.');
      return;
    }
    const okToProceed = await gatePaidActionOrShowPricing();
    if (!okToProceed) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedPrompt('');
    setGeneratedImageUrl(null);

    try {
      const staticAdBase64 = await compressImageForApi(staticAdImage);
      const productBase64 = productImage ? await compressImageForApi(productImage) : null;
      const aspect = getResolvedAspectRatio();

      if (hasSupabase && authUserId) {
        const referenceUploadRes = await fetch('/api/upload-product-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ productImageBase64: staticAdBase64 }),
        });
        const { data: refData, errorMessage: refErr } = await parseJsonResponse<{ url?: string }>(
          referenceUploadRes
        );
        if (refErr || !referenceUploadRes.ok || !refData?.url) {
          throw new Error(refErr || 'Failed to upload reference ad.');
        }

        let productImageUrl: string | null = null;
        if (productBase64) {
          const uploadRes = await fetch('/api/upload-product-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ productImageBase64: productBase64 }),
          });
          const { data: uploadData, errorMessage: upErr } = await parseJsonResponse<{ url?: string }>(
            uploadRes
          );
          if (upErr || !uploadRes.ok || !uploadData?.url) {
            throw new Error(upErr || 'Failed to upload product image.');
          }
          productImageUrl = uploadData.url;
        }

        const useSavedProduct = !!selectedProductId;
        const copyUrl =
          !useSavedProduct && copywriting.trim() && isValidUrl(copywriting.trim())
            ? copywriting.trim()
            : null;

        const asyncBody: Record<string, unknown> = {
          referenceImageUrl: refData.url,
          aspectRatio: aspect,
          guidelines: guidelines.trim() || null,
          copyLanguage,
        };
        if (selectedProductId) asyncBody.productId = selectedProductId;
        else if (productImageUrl) asyncBody.productImageUrl = productImageUrl;
        if (selectedProductId && refreshProductPage) asyncBody.refreshProductPage = true;
        if (copyUrl) asyncBody.copywritingUrl = copyUrl;
        else if (!useSavedProduct && copywriting.trim()) asyncBody.copywriting = copywriting.trim();

        const asyncRes = await fetch('/api/generate-ad-async', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(asyncBody),
        });
        const { data: asyncData, errorMessage: asyncErr } = await parseJsonResponse<{
          status?: string;
          creationId?: string;
          error?: string;
        }>(asyncRes);

        if (asyncRes.status === 401) {
          window.location.href = '/login?next=/app';
          return;
        }
        if (asyncRes.status === 402 || asyncRes.status === 404) {
          setError(null);
          setShowPricingModal(true);
          return;
        }
        if (
          !asyncRes.ok ||
          (asyncRes.status !== 202 && asyncData?.status !== 'processing') ||
          !asyncData?.creationId
        ) {
          throw new Error(asyncErr || asyncData?.error || 'Could not start generation.');
        }

        const creationId = asyncData.creationId;
        const optimistic: CreationItem = {
          id: creationId,
          image_url: null,
          aspect_ratio: aspect,
          created_at: new Date().toISOString(),
          status: 'generating',
          reference_image_url: refData.url,
        };
        setCreations((prev) => {
          const next = [optimistic, ...prev.filter((c) => c.id !== creationId)];
          writeCreationsCache(authUserId, next);
          return next;
        });
        setPendingImageJob(creationId);
        setPendingPreviewCreationId(creationId);
        setError(null);
        void loadCreations({ silent: true });
        void fetchSubscription();
        return;
      }

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
        if (refreshProductPage) promptBody.refreshProductPage = true;
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

      const [response, uploadRes] = await Promise.all([
        fetch('/api/generate-static-ad-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(promptBody),
        }),
        uploadPromise,
      ]);

      const { data: promptData, errorMessage: promptErr } = await parseJsonResponse<{
        prompt?: string;
        adVisualMode?: AdVisualMode;
        error?: string;
        matchedProductImageUrls?: string[];
        hasDedicatedLogo?: boolean;
        hasPersonInReference?: boolean;
        hasIllustrativeVisual?: boolean;
        visualMedium?: string | null;
        illustrationNotes?: string | null;
        productUseProfile?: import('@/lib/products/infer-product-use').ProductUseProfile | null;
        referenceHasPriceVisual?: boolean;
        allowedPrice?: string | null;
        productBrandColors?: string[];
        referenceProductVisibility?: import('@/lib/adaptation/parse-reference-analysis').ReferenceProductVisibility;
      }>(response);
      if (promptErr) {
        throw new Error(promptErr);
      }
      const data = promptData!;

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to generate prompt.');
      }

      setGeneratedPrompt(data.prompt!);
      const adVisualMode: AdVisualMode =
        data.adVisualMode === 'realistic' ? 'realistic' : 'design';
      const matchedUrls = data.matchedProductImageUrls?.filter((u) => u.startsWith('http')) ?? [];

      let productImageUrl: string | null = null;
      let productImageUrls: string[] = matchedUrls.length > 0 ? matchedUrls : [];
      const { data: uploadData } = await parseJsonResponse<{ url?: string }>(uploadRes);
      if (uploadRes.ok && uploadData?.url) {
        productImageUrl = uploadData.url;
        if (
          productImageUrls.length === 0 &&
          data.referenceProductVisibility !== 'none'
        ) {
          productImageUrls = [uploadData.url];
        }
      } else if (
        selectedProduct &&
        productImageUrls.length === 0 &&
        data.referenceProductVisibility !== 'none'
      ) {
        const logos = selectedProduct.images.filter((i) => i.kind === 'logo').map((i) => i.url);
        const productOnly = selectedProduct.images
          .filter((i) => i.kind === 'product' || i.kind === 'other')
          .map((i) => i.url);
        const packaging = selectedProduct.images
          .filter((i) => i.kind === 'packaging')
          .map((i) => i.url);
        const preferProduct =
          data.referenceProductVisibility === 'symbolic-only' ||
          data.referenceProductVisibility === 'loose-units-only';
        const rest = preferProduct
          ? [...productOnly, ...packaging]
          : selectedProduct.images.filter((i) => i.kind !== 'logo').map((i) => i.url);
        productImageUrls = [...logos, ...rest].filter((u) => u.startsWith('http'));
        productImageUrl = selectedProduct.primary_image_url;
        if (productImageUrls.length === 0 && productImageUrl) {
          productImageUrls = [productImageUrl];
        }
      } else if (
        selectedProduct &&
        productImageUrls.length === 0 &&
        data.referenceProductVisibility === 'none'
      ) {
        const logoUrl =
          selectedProduct.images.find((i) => i.kind === 'logo')?.url ??
          selectedProduct.logo_url ??
          null;
        if (logoUrl?.startsWith('http')) {
          productImageUrls = [logoUrl];
          productImageUrl = logoUrl;
        }
      }

      setIsGeneratingImage(true);
      let creationId: string | null = null;
      if (hasSupabase && authUserId) {
        creationId = await createGeneratingCreation(getResolvedAspectRatio(), data.prompt!);
      }

      try {
        const aspect = getResolvedAspectRatio();
        if (creationId && authUserId) {
          const optimistic: CreationItem = {
            id: creationId,
            image_url: null,
            aspect_ratio: aspect,
            created_at: new Date().toISOString(),
            status: 'generating',
          };
          setCreations((prev) => {
            const next = [optimistic, ...prev.filter((c) => c.id !== creationId)];
            writeCreationsCache(authUserId, next);
            return next;
          });
          setPendingPreviewCreationId(creationId);
        }

        const imageBody: Record<string, unknown> = {
          prompt: data.prompt,
          adVisualMode,
          aspectRatio: aspect,
        };
        if (creationId) imageBody.creationId = creationId;
        if (productImageUrls.length > 1) imageBody.productImageUrls = productImageUrls;
        else if (productImageUrl) imageBody.productImageUrl = productImageUrl;
        else if (productBase64) imageBody.productImageBase64 = productBase64;
        if (data.hasDedicatedLogo) imageBody.hasDedicatedLogo = true;
        if (data.hasPersonInReference) imageBody.hasPersonInReference = true;
        if (data.hasIllustrativeVisual) imageBody.hasIllustrativeVisual = true;
        if (data.visualMedium) imageBody.visualMedium = data.visualMedium;
        if (data.illustrationNotes) imageBody.illustrationNotes = data.illustrationNotes;
        if (data.productUseProfile) imageBody.productUseProfile = data.productUseProfile;
        if (data.referenceHasPriceVisual) imageBody.referenceHasPriceVisual = true;
        if (data.allowedPrice) imageBody.allowedPrice = data.allowedPrice;
        if (data.productBrandColors?.length) imageBody.productBrandColors = data.productBrandColors;
        if (data.referenceProductVisibility) {
          imageBody.referenceProductVisibility = data.referenceProductVisibility;
        }

        const useKeepalive = !imageBody.productImageBase64;

        const imgRes = await fetch('/api/generate-ad-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          keepalive: useKeepalive,
          body: JSON.stringify(imageBody),
        });
        const { data: imgData, errorMessage: imgErrMsg } = await parseJsonResponse<{
          imageUrl?: string;
          error?: string;
          creationId?: string;
          status?: string;
        }>(imgRes);

        if (imgRes.status === 202 || imgData?.status === 'processing') {
          const serverCreationId = imgData?.creationId ?? creationId;
          if (serverCreationId) {
            setPendingImageJob(serverCreationId);
            setPendingPreviewCreationId(serverCreationId);
          }
          setError(null);
          void loadCreations({ silent: true });
          void fetchSubscription();
          return;
        }

        if (imgErrMsg) {
          setError(imgErrMsg);
          return;
        }
        if (imgRes.ok && imgData?.imageUrl) {
          setGeneratedImageUrl(imgData.imageUrl);
          clearPendingImageJob(creationId ?? undefined);
          setPendingPreviewCreationId(null);
          if (creationId) {
            await loadCreations({ silent: true });
            await fetchSubscription();
          } else {
            saveCreation(imgData.imageUrl, aspect, data.prompt!);
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
      } catch (imgErr: unknown) {
        if (creationId) {
          setPendingImageJob(creationId);
          setPendingPreviewCreationId(creationId);
          setError(null);
          void loadCreations({ silent: true });
        } else if (isTransientFetchError(imgErr)) {
          setError('Connection lost. If image generation started, check History in a minute.');
        } else {
          setError(imgErr instanceof Error ? imgErr.message : 'Failed to generate image.');
        }
      } finally {
        setIsGeneratingImage(false);
      }
    } catch (err: any) {
      const pending = readPendingImageJob();
      if (pending?.creationId) {
        setPendingPreviewCreationId(pending.creationId);
        setError(null);
        void loadCreations({ silent: true });
      } else if (isTransientFetchError(err)) {
        setError('Connection interrupted. If you already tapped Generate, check History in ~2 min.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsGenerating(false);
      setIsGeneratingImage(false);
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

  const canGenerate = staticAdImage && !!selectedProductId;

  const handleCloneFromLibraryAd = async (imageUrl: string) => {
    try {
      const res = await fetch(`/api/download-image?url=${encodeURIComponent(imageUrl)}&display=1`);
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

  function formatLibraryImpressions(n: number | null | undefined): string | null {
    if (n == null || !Number.isFinite(n) || n <= 0) return null;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return n.toLocaleString();
  }

  const fetchLibraryMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/static-library', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) return;
      setLibraryTotalCount(Number(data.totalCount) || 0);
      setLibraryCategories(Array.isArray(data.categories) ? data.categories : []);
      setLibraryPeriod(data.period ?? null);
      setLibraryLastRun(data.meta?.lastRun ?? null);
    } catch {
      /* meta optional */
    } finally {
      setLibraryMetaLoaded(true);
    }
  }, []);

  const fetchLibraryBrands = useCallback(
    async (opts?: { category?: string }) => {
      const category = opts?.category ?? libraryCategory;
      if (!category || category === 'all') {
        setLibraryBrands([]);
        return;
      }

      setLibraryLoading(true);
      setLibraryError(null);
      setLibraryAds([]);
      setLibraryNextCursor(null);

      try {
        const params = new URLSearchParams({ view: 'brands', category });

        const res = await fetch(`/api/static-library?${params}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) {
          setLibraryError(data?.error || 'Could not load brands.');
          return;
        }
        setLibraryBrands(Array.isArray(data.brands) ? (data.brands as LibraryBrandCard[]) : []);
        await fetchLibraryMeta();
      } catch (e) {
        setLibraryError(e instanceof Error ? e.message : 'Could not load brands.');
      } finally {
        setLibraryLoading(false);
      }
    },
    [libraryCategory, fetchLibraryMeta]
  );

  const libraryBrandsFiltered = useMemo(() => {
    const needle = libraryBrandFilter.trim().toLowerCase();
    if (!needle) return libraryBrands;
    return libraryBrands.filter((b) => b.brandName.toLowerCase().includes(needle));
  }, [libraryBrands, libraryBrandFilter]);

  const fetchStaticLibrary = useCallback(
    async (opts?: {
      cursor?: string | null;
      append?: boolean;
      category?: string;
      brand?: string | null;
      keyword?: string;
      variety?: boolean;
    }) => {
      const append = Boolean(opts?.append);
      const category = opts?.category ?? libraryCategory;
      const brand = opts?.brand !== undefined ? opts.brand : librarySelectedBrand;
      const keyword = opts?.keyword ?? libraryKeywordSearch;
      const useVariety =
        opts?.variety ??
        (libraryBrowseMode === 'all_ads' &&
          category !== 'all' &&
          !brand?.trim() &&
          !keyword.trim());

      if (append) setLibraryLoadingMore(true);
      else {
        setLibraryLoading(true);
        setLibraryError(null);
        if (!opts?.cursor) setLibraryAds([]);
      }

      try {
        const params = new URLSearchParams();
        if (category && category !== 'all') params.set('category', category);
        if (brand?.trim()) params.set('brand', brand.trim());
        if (keyword.trim()) params.set('keyword', keyword.trim());
        if (useVariety) params.set('variety', '1');
        if (opts?.cursor) params.set('cursor', opts.cursor);

        const res = await fetch(`/api/static-library?${params}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) {
          setLibraryError(data?.error || 'Could not load library.');
          return;
        }
        const list = Array.isArray(data.ads) ? (data.ads as LibraryAdCard[]) : [];
        setLibraryAds((prev) => (append ? [...prev, ...list] : list));
        setLibraryNextCursor(data.nextCursor ?? null);
        setLibraryTotalCount(Number(data.totalCount) || 0);
        setLibraryFilteredCount(
          data.filteredCount != null ? Number(data.filteredCount) : null
        );
        setLibraryCategories(Array.isArray(data.categories) ? data.categories : []);
        setLibraryPeriod(data.period ?? null);
        setLibraryLastRun(data.meta?.lastRun ?? null);
      } catch (e) {
        setLibraryError(e instanceof Error ? e.message : 'Could not load library.');
      } finally {
        setLibraryLoading(false);
        setLibraryLoadingMore(false);
      }
    },
    [libraryCategory, librarySelectedBrand, libraryKeywordSearch, libraryBrowseMode]
  );

  const openLibraryBrand = useCallback(
    (brandName: string) => {
      setLibrarySelectedBrand(brandName);
      setLibraryKeywordMode(false);
      fetchStaticLibrary({ brand: brandName, category: libraryCategory });
    },
    [fetchStaticLibrary, libraryCategory]
  );

  const backToLibraryBrands = useCallback(() => {
    setLibrarySelectedBrand(null);
    setLibraryKeywordMode(false);
    setLibraryKeywordSearch('');
    if (libraryBrowseMode === 'brands') fetchLibraryBrands();
    else fetchStaticLibrary({ brand: null, category: libraryCategory });
  }, [fetchLibraryBrands, fetchStaticLibrary, libraryBrowseMode, libraryCategory]);

  const loadLibraryCategory = useCallback(
    (category: string, browse: 'all_ads' | 'brands') => {
      setLibraryCategory(category);
      setLibrarySelectedBrand(null);
      setLibraryKeywordMode(false);
      setLibraryKeywordSearch('');
      setLibraryBrandFilter('');
      if (category === 'all') {
        setLibraryBrands([]);
        setLibraryAds([]);
        fetchLibraryMeta();
        return;
      }
      if (browse === 'all_ads') {
        fetchStaticLibrary({ category, brand: null, keyword: '' });
      } else {
        fetchLibraryBrands({ category });
      }
    },
    [fetchLibraryMeta, fetchLibraryBrands, fetchStaticLibrary]
  );

  function libraryCategoryBadgeClass(category: string): string {
    const base =
      'inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-inset';
    const map: Record<string, string> = {
      sleep: 'bg-indigo-100 text-indigo-800 ring-indigo-200/60',
      beauty: 'bg-pink-100 text-pink-800 ring-pink-200/60',
      supplements: 'bg-emerald-100 text-emerald-800 ring-emerald-200/60',
      fitness: 'bg-orange-100 text-orange-800 ring-orange-200/60',
    };
    return `${base} ${map[category] ?? 'bg-slate-100 text-slate-700 ring-slate-200/60'}`;
  }

  const applyCreations = useCallback((list: CreationItem[], userId: string) => {
    setCreations(list);
    writeCreationsCache(userId, list);
    prefetchCreationImages(list);

    const pendingJob = readPendingImageJob();
    const watchIds = new Set(
      [pendingPreviewCreationId, pendingJob?.creationId].filter(Boolean) as string[]
    );

    for (const id of watchIds) {
      const done = list.find((c) => c.id === id && c.status === 'completed' && c.image_url);
      if (done?.image_url) {
        setGeneratedImageUrl(done.image_url);
        clearPendingImageJob(id);
        setPendingPreviewCreationId(null);
        setError(null);
        return;
      }
      const failed = list.find((c) => c.id === id && c.status === 'failed');
      if (failed) {
        clearPendingImageJob(id);
        setPendingPreviewCreationId(null);
        setError(failed.error_message?.trim() || 'Generation failed. Please try again.');
        return;
      }
    }
  }, [pendingPreviewCreationId]);

  const loadCreations = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!hasSupabase || !authUserId) return;
      if (!opts?.silent) {
        const cached = readCreationsCache(authUserId);
        if (cached?.length) {
          setCreations(cached);
          setCreationsLoading(false);
          prefetchCreationImages(cached);
        } else {
          setCreationsLoading(true);
        }
      }
      try {
        const res = await fetch('/api/creations', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.creations)) {
          applyCreations(data.creations as CreationItem[], authUserId);
        }
      } catch {
        // ignore
      } finally {
        setCreationsLoading(false);
      }
    },
    [hasSupabase, authUserId, applyCreations]
  );

  useEffect(() => {
    if (!hasSupabase || !authUserId) return;
    loadCreations();
  }, [hasSupabase, authUserId, loadCreations]);

  useEffect(() => {
    if (!hasSupabase || !authUserId) return;
    const pending = readPendingImageJob();
    if (!pending?.creationId) return;
    setPendingPreviewCreationId(pending.creationId);
    void loadCreations({ silent: true });
  }, [hasSupabase, authUserId, loadCreations]);

  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u?.email) {
        setUser({
          email: u.email,
          name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email.split('@')[0],
        });
      }
      if (u?.id) setAuthUserId(u.id);
    });
  }, []);

  useEffect(() => {
    if (hasSupabase) fetchSubscription();
  }, [hasSupabase, fetchSubscription]);

  useEffect(() => {
    if (!hasSupabase) return;
    let cancelled = false;

    const syncPaidSubscriptionIfNeeded = async () => {
      let pendingCheckout = false;
      try {
        pendingCheckout = sessionStorage.getItem('pending_whop_checkout') === '1';
      } catch {
        /* ignore */
      }

      const subRes = await fetch('/api/subscription', { credentials: 'include' });
      const subData = subRes.ok ? await subRes.json() : null;
      const pendingFromServer =
        subRes.status === 428 || subData?.pending_checkout === true;
      const hasEntitlement =
        subRes.ok &&
        subData?.ok &&
        isEntitledPlan(subData.plan);

      const paidCredits = Number(subData?.credits_remaining ?? 0);
      const needsSync =
        pendingCheckout ||
        pendingFromServer ||
        !hasEntitlement ||
        (hasEntitlement && (!Number.isFinite(paidCredits) || paidCredits <= 0));

      if (!needsSync) return;

      try {
        await fetch('/api/subscription/mark-checkout', { method: 'POST', credentials: 'include' });
      } catch {
        /* ignore */
      }

      let paymentId: string | null = null;
      try {
        paymentId = sessionStorage.getItem('whop_payment_id');
      } catch {
        /* ignore */
      }

      for (let attempt = 0; attempt < 5 && !cancelled; attempt += 1) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        try {
          await fetch('/api/subscription/sync', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paymentId?.startsWith('pay_') ? { payment_id: paymentId } : {}),
          });
        } catch {
          /* retry */
        }
        const checkRes = await fetch('/api/subscription', { credentials: 'include' });
        if (!checkRes.ok) continue;
        const checkData = await checkRes.json();
        if (
          checkData?.ok &&
          isEntitledPlan(checkData.plan) &&
          Number(checkData.credits_remaining) > 0
        ) {
          try {
            sessionStorage.removeItem('pending_whop_checkout');
            sessionStorage.removeItem('whop_payment_id');
          } catch {
            /* ignore */
          }
          await fetchSubscription();
          try {
            localStorage.removeItem(ONBOARDING_STORAGE);
            setOnboardingDismissed(false);
          } catch {
            /* ignore */
          }
          return;
        }
      }
    };

    void syncPaidSubscriptionIfNeeded();
    return () => {
      cancelled = true;
    };
  }, [hasSupabase, fetchSubscription]);

  useEffect(() => {
    if (hasSupabase) loadProducts();
  }, [hasSupabase, loadProducts]);

  useEffect(() => {
    if (products.length === 0) return;
    if (selectedProductId && products.some((p) => p.id === selectedProductId)) return;
    const first = products[0];
    setSelectedProductId(first.id);
    setProductImage(null);
    setProductPreview(first.primary_image_url);
  }, [products, selectedProductId]);

  useEffect(() => {
    try {
      setOnboardingDismissed(localStorage.getItem(ONBOARDING_STORAGE) === '1');
    } catch {
      setOnboardingDismissed(false);
    }
  }, []);

  useEffect(() => {
    if (!currentPlan || productsLoading) return;
    try {
      const lastPlan = localStorage.getItem(LAST_PLAN_STORAGE);
      const upgraded =
        lastPlan != null &&
        subscriptionPlanRank(currentPlan) > subscriptionPlanRank(lastPlan);
      if (upgraded && products.length === 0) {
        localStorage.removeItem(ONBOARDING_STORAGE);
        setOnboardingDismissed(false);
      }
      localStorage.setItem(LAST_PLAN_STORAGE, currentPlan);
    } catch {
      // ignore
    }
  }, [currentPlan, products.length, productsLoading]);

  const showOnboarding =
    hasSupabase && !productsLoading && products.length === 0 && !onboardingDismissed;

  const dismissOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE, '1');
    } catch {
      // ignore
    }
    setOnboardingDismissed(true);
  };

  const libraryResultTotal =
    libraryFilteredCount != null ? libraryFilteredCount : libraryTotalCount;

  useEffect(() => {
    if (hasSupabase && activeTab === 'products') loadProducts();
  }, [activeTab, hasSupabase, loadProducts]);

  useEffect(() => {
    if (hasSupabase && activeTab === 'history') loadCreations();
  }, [activeTab, hasSupabase, loadCreations]);

  useEffect(() => {
    if (!hasSupabase || activeTab !== 'ad-library') return;
    fetchLibraryMeta();
    if (libraryKeywordMode && libraryKeywordSearch.trim()) {
      fetchStaticLibrary();
      return;
    }
    if (librarySelectedBrand) {
      fetchStaticLibrary();
      return;
    }
    if (libraryCategory !== 'all') {
      if (libraryBrowseMode === 'all_ads') {
        fetchStaticLibrary({ category: libraryCategory, brand: null, keyword: '' });
      } else {
        fetchLibraryBrands();
      }
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, hasSupabase]);

  const hasGenerating = creations.some(
    (c) => c.status === 'generating' || (!c.image_url && c.status !== 'failed')
  );
  const isPreviewLoading =
    isGenerating || isGeneratingImage || Boolean(pendingPreviewCreationId);
  const previewLoadingPhase =
    isGenerating && !isGeneratingImage && !pendingPreviewCreationId ? 'upload' : 'generate';
  useEffect(() => {
    if (!hasSupabase || !authUserId || (!hasGenerating && !pendingPreviewCreationId)) return;
    const ms = pendingPreviewCreationId ? 2500 : 4000;
    const interval = setInterval(() => loadCreations({ silent: true }), ms);
    return () => clearInterval(interval);
  }, [hasSupabase, authUserId, hasGenerating, pendingPreviewCreationId, loadCreations]);

  useEffect(() => {
    if (!hasSupabase || !authUserId) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (readPendingImageJob()) {
          setError(null);
        }
        void loadCreations({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [hasSupabase, authUserId, loadCreations]);

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
        await fetchSubscription();
      } catch {
        // ignore
      }
    },
    [hasSupabase, loadCreations, fetchSubscription]
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

      {referencePreviewUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setReferencePreviewUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-800">{referencePreviewUrl.title}</span>
              <button
                type="button"
                onClick={() => setReferencePreviewUrl(null)}
                className="dash-icon-btn-sm"
                title={t('common', 'close')}
              >
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex items-center justify-center overflow-auto bg-slate-50 p-4">
              <ProxiedImage
                src={referencePreviewUrl.url}
                alt={referencePreviewUrl.title}
                className="max-h-[70vh] w-auto rounded-lg object-contain"
                fallbackClassName="aspect-[9/16] w-full"
              />
            </div>
          </div>
        </div>
      )}

      <DashboardShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sidebarOpen={sidebarOpen}
        onSidebarOpen={setSidebarOpen}
        creditsRemaining={creditsRemaining}
        planName={planName}
        productCount={productCount}
        maxProducts={maxProducts}
        canCancelSubscription={canCancelSubscription}
        cancelAtPeriodEnd={cancelAtPeriodEnd}
        isTeamMember={isTeamMember}
        teamOwnerEmail={teamOwnerEmail}
        onSubscriptionRefresh={fetchSubscription}
        user={user}
        onUpgrade={() => setShowPricingModal(true)}
        onSignOut={handleSignOut}
      >
          {activeTab === 'history' && hasSupabase ? (
          <div className="dash-card dash-card-lg dash-animate-in">
            <h1 className="dash-title">{t('nav', 'history')}</h1>
            <div className="dash-title-accent" aria-hidden />
            <p className="dash-text-muted mb-2">{t('history', 'retention')}</p>
            <p className="dash-text-muted-sm mb-6 text-slate-500">{t('history', 'referenceHint')}</p>
            {creationsLoading && creations.length === 0 ? (
              <div className="flex items-center justify-center py-12"><svg className="h-8 w-8 dash-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>
            ) : creations.length === 0 ? (
              <p className="dash-text-muted py-12 text-center">{t('history', 'empty')}</p>
            ) : (
              <div className="dash-grid-media">
                {creations.map((c, index) => {
                  const isFailed = c.status === 'failed';
                  const isGenerating =
                    !isFailed && (c.status === 'generating' || !c.image_url);
                  return (
                    <div key={c.id} className="dash-media-card">
                      {isGenerating ? (
                        <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 dash-bg-muted p-4">
                          <svg className="h-6 w-6 dash-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          <span className="dash-text-muted-sm font-medium">{t('history', 'generating')}</span>
                        </div>
                      ) : isFailed ? (
                        <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 bg-red-50 p-4 text-center">
                          <span className="text-xs font-medium text-red-700">{t('history', 'failed')}</span>
                          {c.error_message ? (
                            <span className="line-clamp-4 text-[10px] text-red-600">{c.error_message}</span>
                          ) : (
                            <span className="text-[10px] text-red-600">{t('history', 'tryAgain')}</span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setReferencePreviewUrl({
                              url: c.image_url!,
                              title: t('history', 'generatedAd'),
                            })
                          }
                          className="group relative block aspect-[9/16] w-full cursor-zoom-in dash-bg-muted text-left"
                        >
                          <ProxiedImage
                            src={c.image_url!}
                            alt=""
                            className="h-full w-full object-cover transition group-hover:brightness-95"
                            fallbackClassName="aspect-[9/16] w-full"
                            loading={index < 12 ? 'eager' : 'lazy'}
                            decoding="async"
                            fetchPriority={index < 6 ? 'high' : 'auto'}
                          />
                        </button>
                      )}
                      <div className="flex flex-col gap-2 p-2 sm:p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="dash-text-muted-sm truncate">{c.aspect_ratio || '—'} · {new Date(c.created_at).toLocaleDateString()}</span>
                          {!isGenerating && !isFailed && (
                            <div className="flex shrink-0 gap-1">
                              <a href={c.image_url!} target="_blank" rel="noopener noreferrer" className="dash-icon-btn-sm" title={t('common', 'open')}><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>
                              <button type="button" onClick={() => handleDownloadImage(c.image_url!, 'generated-ad.jpg')} className="dash-btn dash-btn-primary !px-2 !py-1.5" title={t('common', 'download')}><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
                            </div>
                          )}
                        </div>
                        {!isGenerating && !isFailed && c.reference_image_url && (
                          <button
                            type="button"
                            onClick={() =>
                              setReferencePreviewUrl({
                                url: c.reference_image_url!,
                                title: t('history', 'referenceAdUsed'),
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-xs font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            {t('history', 'viewReference')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          ) : activeTab === 'ad-library' ? (
        <div className="space-y-6">
          <header className="dash-animate-in">
            <h1 className="dash-title">{t('library', 'title')}</h1>
            <div className="dash-title-accent" aria-hidden />
            <p className="dash-subtitle mt-3">{t('library', 'subtitle')}</p>
          </header>

          <div className="dash-card dash-card-lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex-1 min-w-[140px]">
                <label className="mb-1 block text-xs font-medium text-slate-600">{t('library', 'category')}</label>
                <DashCombobox
                  value={libraryCategory}
                  onChange={(v) => loadLibraryCategory(v, libraryBrowseMode)}
                  placeholder={t('library', 'chooseCategory')}
                  options={[
                    { value: 'all', label: t('library', 'chooseCategory') },
                    ...libraryCategories.map((c) => ({
                      value: c,
                      label: c.charAt(0).toUpperCase() + c.slice(1),
                    })),
                  ]}
                  aria-label={t('library', 'category')}
                />
              </div>
              {libraryCategory !== 'all' && !libraryKeywordMode && !librarySelectedBrand ? (
                <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setLibraryBrowseMode('all_ads');
                      loadLibraryCategory(libraryCategory, 'all_ads');
                    }}
                    className={`rounded-md px-3 py-1.5 font-medium ${
                      libraryBrowseMode === 'all_ads'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t('library', 'allAds')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLibraryBrowseMode('brands');
                      loadLibraryCategory(libraryCategory, 'brands');
                    }}
                    className={`rounded-md px-3 py-1.5 font-medium ${
                      libraryBrowseMode === 'brands'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t('library', 'byBrand')}
                  </button>
                </div>
              ) : null}
              {!libraryKeywordMode &&
              !librarySelectedBrand &&
              libraryCategory !== 'all' &&
              libraryBrowseMode === 'brands' ? (
                <div className="flex-[2] min-w-[180px]">
                  <label className="mb-1 block text-xs font-medium text-slate-600">{t('library', 'byBrand')}</label>
                  <input
                    type="search"
                    value={libraryBrandFilter}
                    onChange={(e) => setLibraryBrandFilter(e.target.value)}
                    placeholder={t('library', 'filterBrands')}
                    className="dash-input w-full text-sm"
                  />
                </div>
              ) : null}
              <div className="flex-[2] min-w-[180px]">
                <label className="mb-1 block text-xs font-medium text-slate-600">{t('library', 'keywordOptional')}</label>
                <input
                  type="search"
                  value={libraryKeywordSearch}
                  onChange={(e) => setLibraryKeywordSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setLibraryKeywordMode(true);
                      setLibrarySelectedBrand(null);
                      fetchStaticLibrary({ keyword: libraryKeywordSearch, brand: null });
                    }
                  }}
                  placeholder="skincare, creatine…"
                  className="dash-input w-full text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (libraryKeywordSearch.trim()) {
                    setLibraryKeywordMode(true);
                    setLibrarySelectedBrand(null);
                    fetchStaticLibrary({ keyword: libraryKeywordSearch, brand: null });
                  } else if (libraryCategory !== 'all') {
                    setLibraryKeywordMode(false);
                    if (libraryBrowseMode === 'all_ads') {
                      fetchStaticLibrary({ category: libraryCategory, brand: null, keyword: '' });
                    } else {
                      fetchLibraryBrands();
                    }
                  }
                }}
                disabled={libraryLoading}
                className="dash-btn dash-btn-primary shrink-0 disabled:opacity-50"
              >
                {libraryLoading
                  ? t('library', 'loading')
                  : libraryKeywordSearch.trim()
                    ? t('library', 'searchAds')
                    : t('library', 'showBrands')}
              </button>
            </div>
            {(librarySelectedBrand || libraryKeywordMode) && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    if (libraryKeywordMode) {
                      setLibraryKeywordMode(false);
                      setLibraryKeywordSearch('');
                      if (libraryCategory !== 'all') {
                        if (libraryBrowseMode === 'all_ads') {
                          fetchStaticLibrary({ category: libraryCategory, brand: null, keyword: '' });
                        } else fetchLibraryBrands();
                      }
                      else {
                        setLibraryAds([]);
                        fetchLibraryMeta();
                      }
                    } else {
                      backToLibraryBrands();
                    }
                  }}
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  ← {t('library', 'back')}
                </button>
                <span className="text-slate-400">/</span>
                {libraryCategory !== 'all' && (
                  <span className={libraryCategoryBadgeClass(libraryCategory)}>{libraryCategory}</span>
                )}
                {librarySelectedBrand && (
                  <span className="font-medium text-slate-900">{librarySelectedBrand}</span>
                )}
                {libraryKeywordMode && libraryKeywordSearch.trim() && (
                  <span className="text-slate-600">
                    keyword: <strong>{libraryKeywordSearch.trim()}</strong>
                  </span>
                )}
              </div>
            )}
            {libraryError && <p className="mt-3 text-sm text-red-600">{libraryError}</p>}
            {libraryLoading && libraryAds.length === 0 && libraryBrands.length === 0 && (
              <p className="mt-3 text-sm text-slate-600">Loading…</p>
            )}
            {!libraryMetaLoaded && !libraryLoading && libraryCategory === 'all' && (
              <p className="mt-3 text-sm text-slate-600">Loading…</p>
            )}
            {libraryCategory === 'all' && !libraryKeywordMode && !librarySelectedBrand && (
              <p className="mt-3 text-sm text-slate-600">
                Choose a category (e.g. beauty) to browse ads across brands, or switch to brand view.
              </p>
            )}
            {libraryMetaLoaded && libraryTotalCount === 0 && !libraryLoading && !libraryError && (
              <p className="mt-3 text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
                Library is empty. Run bootstrap ingest:{' '}
                <code className="text-xs">npm run ingest-library:brands</code> (requires SCRAPECREATORS_API_KEY and migrations 010–012).
              </p>
            )}
          </div>

          {!librarySelectedBrand &&
          !libraryKeywordMode &&
          libraryCategory !== 'all' &&
          libraryBrowseMode === 'brands' ? (
            <div className="dash-card dash-card-lg">
              <h2 className="mb-4 text-base font-semibold text-slate-900">
                Brands in {libraryCategory} ({libraryBrandsFiltered.length}
                {libraryBrandFilter.trim() && libraryBrandsFiltered.length !== libraryBrands.length
                  ? ` of ${libraryBrands.length}`
                  : ''}
                )
              </h2>
              <p className="mb-4 text-xs text-slate-500">
                Sorted by each brand’s top single-ad impressions. Open a brand to see all its ads (highest → lowest).
              </p>
              {libraryBrandsFiltered.length > 0 ? (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {libraryBrandsFiltered.map((b) => {
                    const top = formatLibraryImpressions(b.maxImpressions);
                    return (
                      <li key={b.brandName}>
                        <button
                          type="button"
                          onClick={() => openLibraryBrand(b.brandName)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                        >
                          <span className="font-medium text-slate-900 truncate">{b.brandName}</span>
                          <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                            {b.adCount} ad{b.adCount !== 1 ? 's' : ''}
                            {top ? (
                              <>
                                {' '}
                                · top <strong className="text-slate-700">{top}</strong> imp.
                              </>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : !libraryLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No brands in this category{libraryBrandFilter.trim() ? ' match your filter' : ''}.
                </p>
              ) : null}
            </div>
          ) : null}

          {(librarySelectedBrand ||
            libraryKeywordMode ||
            (libraryCategory !== 'all' && libraryBrowseMode === 'all_ads')) && (
          <div className="dash-card dash-card-lg">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              {librarySelectedBrand ? (
                <>Ads · {librarySelectedBrand}</>
              ) : libraryKeywordMode ? (
                <>Ads · keyword</>
              ) : (
                <>Ads · {libraryCategory}</>
              )}{' '}
              {t('library', 'adsCount', {
                shown: libraryAds.length,
                total: libraryResultTotal.toLocaleString(),
              })}
            </h2>
            {libraryAds.length > 0 ? (
              <>
                <div className="dash-library-grid">
                  {libraryAds.map((ad) => {
                    const impressions = formatLibraryImpressions(ad.totalImpressions);
                    return (
                    <article key={ad.id} className="dash-library-card group">
                      <button
                        type="button"
                        onClick={() => handleCloneFromLibraryAd(ad.imageUrl)}
                        className="dash-library-card-media"
                        title={t('library', 'clone')}
                      >
                        <ProxiedImage
                          src={ad.imageUrl}
                          alt=""
                          className="transition-transform duration-500 group-hover:scale-[1.03]"
                          fallbackClassName="flex items-center justify-center"
                          loading="lazy"
                        />
                      </button>
                      <div className="dash-library-card-body">
                        <span className={libraryCategoryBadgeClass(ad.category)}>{ad.category}</span>
                        {ad.pageName ? (
                          <button
                            type="button"
                            onClick={() => openLibraryBrand(ad.pageName!)}
                            className="dash-library-card-title"
                          >
                            {ad.pageName}
                          </button>
                        ) : (
                          <p className="dash-library-card-title">{ad.seedLabel}</p>
                        )}
                        <p className={impressions ? 'dash-library-card-meta' : 'dash-library-card-meta dash-library-card-meta--empty'}>
                          {impressions ? `${impressions} ${t('library', 'impressions')}` : '—'}
                        </p>
                        <p className={ad.bodyPreview ? 'dash-library-card-desc' : 'dash-library-card-desc dash-library-card-desc--empty'}>
                          {ad.bodyPreview || '—'}
                        </p>
                        <div className="dash-library-card-actions">
                          <button
                            type="button"
                            onClick={() => handleCloneFromLibraryAd(ad.imageUrl)}
                            className="dash-btn dash-btn-primary"
                          >
                            {t('library', 'clone')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadImage(ad.imageUrl, 'library-ad.jpg')}
                            className="dash-library-download-btn"
                            title={t('common', 'download')}
                            aria-label={t('common', 'download')}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    </article>
                    );
                  })}
                </div>
                {libraryNextCursor && (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      disabled={libraryLoadingMore}
                      onClick={() => fetchStaticLibrary({ cursor: libraryNextCursor, append: true })}
                      className="dash-btn dash-btn-secondary disabled:opacity-50"
                    >
                      {libraryLoadingMore ? t('library', 'loading') : t('library', 'loadMore')}
                    </button>
                  </div>
                )}
              </>
            ) : !libraryLoading ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No ads
                {librarySelectedBrand
                  ? ' for this brand'
                  : libraryKeywordMode
                    ? ' for this keyword'
                    : ' in this category yet'}
                . Run <code className="text-xs">npm run ingest-library:brands</code> or try another filter.
              </p>
            ) : null}
          </div>
          )}
        </div>
          ) : activeTab === 'products' ? (
        <div className="space-y-6">
          <header className="dash-animate-in flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="dash-title">{t('products', 'title')}</h1>
              <div className="dash-title-accent" aria-hidden />
              <p className="dash-subtitle mt-3">{t('products', 'subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!canAddProduct) {
                  setShowPricingModal(true);
                  return;
                }
                setShowProductModal(true);
              }}
              disabled={!canAddProduct}
              className="dash-btn dash-btn-primary shrink-0 disabled:opacity-50"
            >
              + {t('products', 'addProduct')}
            </button>
          </header>
          {maxProducts !== null && productCount !== null && (
            <p className="dash-text-muted">
              {productCount}/{formatMaxProductsLabel(maxProducts)} products saved
              {!canAddProduct && ' — upgrade to add more'}
            </p>
          )}
          {productsLoading ? (
            <p className="dash-text-muted">Loading products…</p>
          ) : products.length === 0 ? (
            <div className="dash-empty dash-card border-dashed">
              <p className="dash-empty-title">No products yet</p>
              <p className="dash-empty-desc">Add a product from its store URL or enter details manually with up to 3 photos.</p>
              <button
                type="button"
                onClick={() => {
                  if (!canAddProduct) {
                    setShowPricingModal(true);
                    return;
                  }
                  setShowProductModal(true);
                }}
                className="dash-btn dash-btn-primary mt-4"
              >
                Add your first product
              </button>
            </div>
          ) : (
            <div className="dash-product-grid">
              {products.map((p) => (
                <article key={p.id} className="dash-product-card">
                  <button
                    type="button"
                    onClick={() => setDetailProduct(p)}
                    className="dash-product-card-main"
                  >
                    <div className="dash-product-card-thumb">
                      <ProxiedImage src={p.primary_image_url} alt={p.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="dash-product-card-body">
                      <h3 className="dash-product-card-title">{p.name}</h3>
                      <p className="dash-product-card-meta">
                        {p.source === 'url' ? t('products', 'fromUrl') : t('products', 'manual')}
                        {' · '}
                        {p.images.length} {p.images.length === 1 ? 'image' : 'images'}
                      </p>
                      <span className="dash-product-card-link">{t('products', 'editHint')}</span>
                    </div>
                  </button>
                  <div className="dash-product-card-actions">
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectProduct(p.id);
                        setActiveTab('new');
                      }}
                      className="dash-btn dash-btn-primary dash-product-card-cta"
                    >
                      {t('products', 'useInMirror')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteProduct(p.id)}
                      className="dash-btn dash-btn-danger dash-product-card-delete"
                      aria-label={t('products', 'delete')}
                      title={t('products', 'delete')}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>{t('products', 'delete')}</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
          ) : activeTab === 'team' ? (
            <TeamMembersPanel />
          ) : activeTab === 'support' ? (
        <div className="dash-card dash-card-lg max-w-2xl dash-animate-in">
          <h1 className="dash-title">Support</h1>
          <div className="dash-title-accent" aria-hidden />
          <p className="dash-subtitle mt-3 leading-relaxed">
            Need help with an issue, plan changes, or anything else? We&apos;re here for you.
          </p>
          <ul className="dash-text-muted mt-4 space-y-2">
            <li>• Help with technical problems or bugs</li>
            <li>• Plan upgrades or account questions</li>
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
            <h1 className="dash-title">{t('mirror', 'title')}</h1>
            <div className="dash-title-accent" aria-hidden />
            <p className="dash-subtitle mt-3">{t('mirror', 'subtitle')}</p>
            {hasSupabase && products.length === 0 && !productsLoading && !showOnboarding && (
              <div className="dash-onboarding-tip mt-5">
                <div className="dash-onboarding-tip-icon" aria-hidden>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--dash-fg)]">{t('mirror', 'startHere')}</p>
                  <p className="dash-text-muted mt-1 text-sm leading-relaxed">
                    {t('mirror', 'startHereBefore')}
                    <button
                      type="button"
                      className="font-semibold text-[var(--brand-indigo)] underline decoration-[var(--brand-purple)]/40 underline-offset-2 hover:opacity-80"
                      onClick={() => setActiveTab('products')}
                    >
                      {t('nav', 'products')}
                    </button>
                    {t('mirror', 'startHereAfter')}
                  </p>
                </div>
              </div>
            )}
          </header>

        <div className="dash-workspace">
          <div className="dash-workspace-form dash-segment-stack">
            <section className="dash-card">
              <StepHeader
                step={1}
                title={t('mirror', 'visualAssets')}
                badge={<span className="dash-badge dash-badge-required shrink-0">{t('common', 'required')}</span>}
              />
              <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 sm:gap-4">
                <div className="dash-upload-slot">
                  <p className="dash-label mb-1">{t('mirror', 'referenceAd')}</p>
                  <input type="file" accept="image/*" onChange={handleStaticAdUpload} className="hidden" id="static-ad-upload" />
                  <label htmlFor="static-ad-upload" className="dash-upload group">
                    {staticAdPreview ? (
                      <div className="absolute inset-0 h-full w-full p-2"><img src={staticAdPreview} alt="Reference Ad" className="h-full w-full rounded-lg object-cover shadow-sm" /><div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"><span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[var(--dash-fg)] backdrop-blur-sm">{t('mirror', 'change')}</span></div></div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 sm:gap-3 text-center p-2 sm:p-4">
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-[var(--dash-border)] bg-white shadow-sm"><svg className="h-5 w-5 text-[var(--brand-indigo)]" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>
                        <div><p className="text-xs sm:text-sm font-medium text-[var(--dash-fg)]">{t('mirror', 'referenceAd')}</p><p className="dash-muted-text mt-0.5">{t('mirror', 'styleToCopy')}</p></div>
                      </div>
                    )}
                  </label>
                </div>
                <div className="dash-upload-slot">
                  {products.length > 0 ? (
                    <>
                      <label className="dash-label mb-1.5" htmlFor="product-select">{t('mirror', 'yourProduct')}</label>
                      <ProductSourcePicker
                        products={products}
                        value={selectedProductId}
                        onChange={(id) => {
                          if (id) handleSelectProduct(id);
                        }}
                      />
                      <div className="dash-upload mt-1 pointer-events-none">
                        {productPreview ? (
                          <div className="absolute inset-0 h-full w-full p-2">
                            <img src={productPreview} alt="Your product" className="h-full w-full rounded-lg object-cover shadow-sm" />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 sm:gap-3 text-center p-2 sm:p-4">
                            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-[var(--dash-border)] bg-white shadow-sm">
                              <svg className="h-5 w-5 text-[var(--brand-indigo)]" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                            </div>
                            <div>
                              <p className="text-xs sm:text-sm font-medium text-[var(--dash-fg)]">{t('mirror', 'savedProduct')}</p>
                              <p className="dash-muted-text mt-0.5">{t('mirror', 'chooseFromList')}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      {selectedProduct && (
                        <div className="mt-2 space-y-2">
                          <p className="dash-muted-text text-center text-[var(--brand-indigo)]">
                            {t('mirror', 'storedMeta', { count: selectedProduct.images.length })}
                          </p>
                          {selectedProduct.product_url && (
                            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--dash-border)] bg-white/60 px-3 py-2.5">
                              <input
                                type="checkbox"
                                checked={refreshProductPage}
                                onChange={(e) => setRefreshProductPage(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-[var(--dash-border)] text-[var(--brand-indigo)]"
                              />
                              <span className="text-left">
                                <span className="block text-xs font-medium text-[var(--dash-fg)]">
                                  {t('mirror', 'refreshProductPage')}
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-snug text-[var(--dash-muted)]">
                                  {t('mirror', 'refreshProductPageHint')}
                                </span>
                              </span>
                            </label>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--dash-border)] bg-[var(--dash-muted-bg)] p-6 text-center">
                      <p className="text-sm font-semibold text-[var(--dash-fg)]">{t('mirror', 'addProductFirst')}</p>
                      <p className="dash-muted-text mt-1 max-w-[220px] text-xs leading-relaxed">
                        {t('mirror', 'addProductFirstHint')}
                      </p>
                      <button
                        type="button"
                        className="dash-btn dash-btn-secondary mt-4 text-xs"
                        onClick={() => setActiveTab('products')}
                      >
                        {t('mirror', 'goToProducts')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-4 border-t border-[var(--dash-border)]">
                <label className="dash-label mb-2">{t('mirror', 'outputSize')}</label>
                <DashCombobox
                  value={imageSize}
                  onChange={(v) => setImageSize(v as ImageSizeOption)}
                  options={ASPECT_RATIO_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label:
                      opt.value === 'auto' && referenceAdDimensions
                        ? `Auto (${referenceAdDimensions.width}×${referenceAdDimensions.height})`
                        : opt.label,
                  }))}
                  aria-label="Output size"
                />
                <p className="dash-muted-text mt-1.5">{imageSize === 'auto' && referenceAdDimensions ? `Using aspect ratio from reference ad (${getResolvedAspectRatio()}).` : imageSize === 'auto' ? 'Match reference ad proportions (vertical by default).' : `Fixed aspect ratio: ${imageSize}.`}</p>
              </div>
            </section>
            <section className="dash-card">
              <StepHeader
                step={2}
                title={t('mirror', 'context')}
                badge={<span className="dash-badge dash-badge-optional shrink-0">{t('common', 'optional')}</span>}
              />
              <div className="space-y-4">
                <div>
                  <label className="dash-label mb-1.5">{t('mirror', 'copyLanguage')}</label>
                  <CopyLanguagePicker value={copyLanguage} onChange={setCopyLanguage} />
                  <p className="dash-muted-text mt-1.5">{t('mirror', 'copyLanguageHint')}</p>
                </div>
                {selectedProduct && (
                  <p className="dash-muted-text text-sm">{t('mirror', 'usingSavedProduct')}</p>
                )}
                <div>
                  <label className="dash-label mb-1.5">Creative guidelines</label>
                  <textarea value={guidelines} onChange={(e) => setGuidelines(e.target.value)} placeholder="e.g., Change the background to a sunny beach, remove all text overlays, make it moody..." rows={3} className="dash-input dash-textarea min-h-[88px]" />
                </div>
              </div>
            </section>
            <div className="dash-card dash-card-cta">
              <button type="button" onClick={handleGenerate} disabled={!canGenerate || isGenerating} className="dash-btn dash-btn-primary w-full min-h-[52px] touch-manipulation">
                {isGenerating ? <><svg className="h-4 w-4 animate-spin text-white/90" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>{isScraping ? 'Analyzing URL...' : `${t('mirror', 'generateImage')}…`}</span></> : <><span>{t('mirror', 'generateImage')}</span><svg className="h-4 w-4 text-white/90 transition-transform group-hover:translate-x-0.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></>}
              </button>
              {error && <div className="dash-alert dash-alert-error mt-4"><svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>{error}</p></div>}
            </div>
          </div>
          <div className="dash-workspace-preview dash-sticky-preview dash-animate-in">
            <div className="dash-preview-panel dash-preview-panel--mirror flex">
              <div className="dash-preview-panel-header shrink-0">
                <span className="dash-preview-panel-label">{t('mirror', 'generatedImage')}</span>
                {generatedImageUrl && <a href={generatedImageUrl} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn-secondary !px-3 !py-2 text-xs min-h-[40px] items-center"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Open</a>}
              </div>
              <div className="dash-preview-panel-body">
                {!generatedImageUrl && !isPreviewLoading ? (
                  <div className="flex flex-col items-center justify-center text-center px-2">
                    <div className="dash-empty-icon mb-3 sm:mb-4 h-14 w-14 sm:h-16 sm:w-16 rounded-2xl">
                      <svg className="h-7 w-7 sm:h-8 sm:w-8 text-[var(--brand-indigo)]" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--dash-fg)]">{t('mirror', 'previewEmpty')}</h3>
                    <p className="dash-text-muted-sm mt-1 max-w-[260px]">{t('mirror', 'previewHint')}</p>
                  </div>
                ) : isPreviewLoading ? (
                  <AdPreviewLoading phase={previewLoadingPhase} />
                ) : generatedImageUrl ? (
                  <div className="flex w-full min-h-0 flex-1 flex-col items-center">
                    <div className="dash-preview-generated-wrap">
                      <a href={generatedImageUrl} target="_blank" rel="noopener noreferrer" className="block">
                        <ProxiedImage src={generatedImageUrl} alt="Generated ad" className="dash-preview-generated-image" />
                      </a>
                    </div>
                    <div className="mt-3 flex shrink-0 flex-wrap items-center justify-center gap-2 sm:mt-4 sm:gap-3">
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
          void fetchSubscription();
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
          void fetchSubscription();
        }}
      />

      <OnboardingWelcome
        open={showOnboarding}
        onUpload={() => {
          dismissOnboarding();
          setActiveTab('products');
          setShowProductModal(true);
        }}
        onSkip={dismissOnboarding}
      />
    </>
  );
}

export default function StaticAdPromptGenerator() {
  return (
    <AppProviders>
      <StaticAdAppPage />
    </AppProviders>
  );
}
