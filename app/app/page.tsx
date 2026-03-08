'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient as createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { ClonestaticLogo } from '../components/ClonestaticLogo';

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
  image_url: string;
  aspect_ratio: string | null;
  created_at: string;
};

export default function StaticAdPromptGenerator() {
  const [staticAdImage, setStaticAdImage] = useState<File | null>(null);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [copywriting, setCopywriting] = useState<string>('');
  const [guidelines, setGuidelines] = useState<string>('');
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [staticAdPreview, setStaticAdPreview] = useState<string | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [costInfo, setCostInfo] = useState<any>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [imageSize, setImageSize] = useState<ImageSizeOption>('auto');
  const [referenceAdDimensions, setReferenceAdDimensions] = useState<{ width: number; height: number } | null>(null);

  const hasSupabase = isSupabaseConfigured();
  const [activeTab, setActiveTab] = useState<'new' | 'history' | 'edit' | 'support'>('new');
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
      setProductImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setProductPreview(reader.result as string);
      reader.readAsDataURL(file);
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
    if (!staticAdImage || !productImage) {
      setError('Please upload both the reference ad and your product image.');
      return;
    }
    const okToProceed = await gatePaidActionOrShowPricing();
    if (!okToProceed) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedPrompt('');
    setGeneratedImageUrl(null);

    try {
      const staticAdBase64 = await fileToBase64(staticAdImage);
      const productBase64 = await fileToBase64(productImage);

      const isUrl = copywriting.trim() && isValidUrl(copywriting.trim());
      let copywritingInput = copywriting || null;

      if (isUrl) {
        setIsScraping(true);
        try {
          const scrapeResponse = await fetch('/api/scrape-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: copywriting.trim() }),
          });
          const scrapeData = await scrapeResponse.json();

          if (!scrapeResponse.ok) {
            throw new Error(scrapeData.error || scrapeData.details || 'Failed to scrape URL.');
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

      const [response, uploadRes] = await Promise.all([
        fetch('/api/generate-static-ad-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staticAdImage: staticAdBase64,
            productImage: productBase64,
            copywriting: copywritingInput || null,
            isUrlScraped: isUrl,
            guidelines: guidelines.trim() || null,
          }),
        }),
        fetch('/api/upload-product-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productImageBase64: productBase64 }),
        }),
      ]);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate prompt.');
      }

      setGeneratedPrompt(data.prompt);
      setCostInfo(data.cost || null);

      const productImageUrl = uploadRes.ok ? (await uploadRes.json()).url : null;

      setIsGeneratingImage(true);
      try {
        const imgRes = await fetch('/api/generate-ad-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: data.prompt,
            ...(productImageUrl ? { productImageUrl } : { productImageBase64: productBase64 }),
            aspectRatio: getResolvedAspectRatio(),
          }),
        });
        const imgData = await imgRes.json();
        if (imgRes.ok && imgData.imageUrl) {
          setGeneratedImageUrl(imgData.imageUrl);
          saveCreation(imgData.imageUrl, getResolvedAspectRatio(), data.prompt);
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
          setError(imgData.error || 'Failed to generate image.');
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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
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

  const canGenerate = staticAdImage && productImage;

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
      const promptRes = await fetch('/api/generate-edit-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: editSourcePreview,
          instructions: editInstructions.trim(),
        }),
      });
      const promptData = await promptRes.json();
      if (!promptRes.ok || !promptData?.prompt) {
        throw new Error(promptData?.error || 'Failed to generate edit prompt.');
      }
      setEditPrompt(promptData.prompt);

      const editRes = await fetch('/api/edit-ad-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptData.prompt,
          imageBase64: editSourcePreview,
          aspectRatio: 'auto',
        }),
      });
      const editData = await editRes.json();
      if (editRes.ok && editData.imageUrl) {
        setEditedImageUrl(editData.imageUrl);
        saveCreation(editData.imageUrl, 'auto', promptData.prompt);
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
    if (hasSupabase && activeTab === 'history') loadCreations();
  }, [activeTab, hasSupabase, loadCreations]);

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
    <main className="min-h-screen bg-slate-50 text-slate-900 flex">
      {showPricingModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-black/40" aria-hidden onClick={() => setShowPricingModal(false)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-3 sm:p-5 shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 sm:text-lg">Choose a plan to generate</h2>
                <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">You can access the dashboard for free. Generating images requires credits.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPricingModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 shrink-0"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-3 sm:p-5 overflow-y-auto flex-1 min-h-0">
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 sm:p-1">
                  <button
                    type="button"
                    onClick={() => setPricingBilling('monthly')}
                    className={`rounded-md sm:rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium transition-colors ${pricingBilling === 'monthly' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingBilling('yearly')}
                    className={`rounded-md sm:rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium transition-colors ${pricingBilling === 'yearly' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Annually
                  </button>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500">Secure checkout via Whop. Use the same Google email.</p>
              </div>

              <div className="mt-3 sm:mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
                <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-900 sm:text-sm">Standard</h3>
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">20 AI images</span>
                  </div>
                  <p className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                    {pricingBilling === 'yearly' ? '$79.99' : '$9.99'}
                    <span className="text-xs sm:text-base font-normal text-slate-500"> {pricingBilling === 'yearly' ? '/ year' : '/ month'}</span>
                  </p>
                  {pricingBilling === 'yearly' && <p className="mt-0.5 text-xs text-slate-500">Billed annually · ~$6.67/mo</p>}
                  <ul className="mt-2 sm:mt-3 space-y-1 sm:space-y-2 text-xs sm:text-sm text-slate-600">
                    <li className="flex gap-1.5 sm:gap-2"><span className="mt-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0">✓</span><strong>20 AI images</strong> (generate or edit)</li>
                    <li className="flex gap-1.5 sm:gap-2"><span className="mt-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>Generate ads from references</li>
                    <li className="flex gap-1.5 sm:gap-2"><span className="mt-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>History + downloads</li>
                  </ul>
                  <a
                    href={`/checkout-redirect?plan=${pricingBilling === 'yearly' ? 'standard_yearly' : 'standard_monthly'}`}
                    className="mt-3 sm:mt-4 inline-flex w-full items-center justify-center rounded-lg sm:rounded-xl bg-sky-500 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600"
                  >
                    Continue
                  </a>
                </div>

                <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-900 p-3 sm:p-5 text-white">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold sm:text-sm">Pro</h3>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white">75 AI images</span>
                  </div>
                  <p className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-bold tracking-tight">
                    {pricingBilling === 'yearly' ? '$229.99' : '$29.99'}
                    <span className="text-xs sm:text-base font-normal text-white/70"> {pricingBilling === 'yearly' ? '/ year' : '/ month'}</span>
                  </p>
                  {pricingBilling === 'yearly' && <p className="mt-0.5 text-xs text-white/70">Billed annually · ~$19.17/mo</p>}
                  <ul className="mt-2 sm:mt-3 space-y-1 sm:space-y-2 text-xs sm:text-sm text-white/80">
                    <li className="flex gap-1.5 sm:gap-2"><span className="mt-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-bold shrink-0">✓</span><strong>75 AI images</strong> (generate or edit)</li>
                    <li className="flex gap-1.5 sm:gap-2"><span className="mt-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>Generate ads from references</li>
                    <li className="flex gap-1.5 sm:gap-2"><span className="mt-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>History + downloads</li>
                  </ul>
                  <a
                    href={`/checkout-redirect?plan=${pricingBilling === 'yearly' ? 'pro_yearly' : 'pro_monthly'}`}
                    className="mt-3 sm:mt-4 inline-flex w-full items-center justify-center rounded-lg sm:rounded-xl bg-white px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
                  >
                    Continue
                  </a>
                </div>
              </div>

              <p className="mt-3 text-center text-xs text-slate-500">Editing an image counts as one generation.</p>

              <div className="mt-3 sm:mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowPricingModal(false)}
                  className="text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Keep exploring
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar: History + User + Logout */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col border-r border-slate-200 bg-white shadow-sm transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 md:justify-center">
          <a href="/" className="flex items-center gap-2 font-semibold">
            <ClonestaticLogo variant="dark" className="text-[#1e3a5f]" />
          </a>
          <button type="button" onClick={() => setSidebarOpen(false)} className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close menu">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <nav className="flex-1 p-4">
          <button
            type="button"
            onClick={() => { setActiveTab('history'); setSidebarOpen(false); }}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            History
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('new'); setSidebarOpen(false); }}
            className={`mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${activeTab === 'new' ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"/></svg>
            Replicate
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('edit'); setSidebarOpen(false); }}
            className={`mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${activeTab === 'edit' ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L16.875 4.5"/></svg>
            Edit
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('support'); setSidebarOpen(false); }}
            className={`mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${activeTab === 'support' ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Support
          </button>
        </nav>
        <div className="border-t border-slate-200 p-4 space-y-2">
          <button
            type="button"
            onClick={() => { setShowPricingModal(true); setSidebarOpen(false); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
            Upgrade plan
          </button>
          {creditsRemaining !== null && (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-xs font-medium text-slate-500">Credits</p>
              <p className="text-lg font-bold text-slate-900 tabular-nums">{creditsRemaining}</p>
            </div>
          )}
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 font-semibold">
              {user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{user?.name ?? 'User'}</p>
              <p className="truncate text-xs text-slate-500">{user?.email ?? '—'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile menu button */}
      <div className="fixed top-4 left-4 z-30 md:hidden">
        <button type="button" onClick={() => setSidebarOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50" aria-label="Open menu">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      </div>

      {/* Overlay when sidebar open on mobile */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" aria-hidden onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 min-h-screen md:ml-64">
        <div className="mx-auto max-w-5xl px-4 pt-14 pb-8 md:pt-8 md:px-6 md:pb-12">
          {activeTab === 'history' && hasSupabase ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Your creations</h2>
            {creationsLoading ? (
              <div className="flex items-center justify-center py-12"><svg className="h-8 w-8 animate-spin text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg></div>
            ) : creations.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">No creations yet. Generate an image in Replicate.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
                {creations.map((c) => (
                  <div key={c.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <a href={c.image_url} target="_blank" rel="noopener noreferrer" className="block aspect-[9/16] w-full bg-slate-100"><img src={c.image_url} alt="" className="h-full w-full object-cover" /></a>
                    <div className="flex items-center justify-between gap-2 p-2 sm:p-3">
                      <span className="truncate text-[10px] sm:text-xs text-slate-500">{c.aspect_ratio || '—'} · {new Date(c.created_at).toLocaleDateString()}</span>
                      <div className="flex shrink-0 gap-1">
                        <a href={c.image_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50" title="Open"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>
                        <button type="button" onClick={() => handleDownloadImage(c.image_url, 'generated-ad.jpg')} className="rounded-lg border border-sky-500 bg-sky-500 p-1.5 text-white hover:bg-sky-600" title="Download"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          ) : activeTab === 'edit' ? (
        <>
          <div className="mb-6 sm:mb-8">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl md:text-3xl">Edit a generated ad</h1>
            <p className="mt-1.5 text-slate-600 sm:text-base md:text-lg">Upload an existing ad and describe changes. We&apos;ll generate an edit prompt and render the updated creative.</p>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 sm:gap-6 lg:grid-cols-12 lg:gap-8">
            <div className="flex flex-col gap-4 sm:gap-5 lg:col-span-5">
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 sm:text-base">1. Upload your ad</h2>
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-medium text-sky-600 shrink-0">REQUIRED</span>
                </div>
                <input type="file" accept="image/*" onChange={handleEditSourceUpload} className="hidden" id="edit-source-upload" />
                <label htmlFor="edit-source-upload" className="group relative flex aspect-[4/5] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-50 transition-all hover:border-sky-300 hover:bg-sky-50/50 active:scale-[0.99]">
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
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 sm:text-base">2. What should change?</h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500 shrink-0">REQUIRED</span>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Edit instructions</label>
                  <textarea value={editInstructions} onChange={(e) => setEditInstructions(e.target.value)} placeholder="Example: Replace the headline with &quot;Buy 2 Get 1 Free&quot;, change the background to a soft gradient, keep the product size and position the same." rows={4} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all min-h-[104px]" />
                </div>
              </section>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                <button type="button" onClick={handleEditGenerate} disabled={!editSourceImage || !editInstructions.trim() || isEditing} className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-slate-900 px-4 py-4 sm:py-3.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 min-h-[52px] touch-manipulation">
                  {isEditing ? (<><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /><span>Editing…</span></>) : (<><span>Generate edit</span><svg className="h-4 w-4 text-white/90 transition-transform group-hover:translate-x-0.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></>)}
                </button>
                {editError && <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>{editError}</p></div>}
              </div>
            </div>
            <div className="lg:col-span-7">
              <div className="sticky top-4 sm:top-8 flex min-h-[280px] sm:min-h-[380px] lg:min-h-[480px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Edited output</span>
                  {editedImageUrl && <a href={editedImageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 min-h-[40px] items-center"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Open</a>}
                </div>
                <div className="relative flex flex-1 flex-col items-center justify-center p-4 sm:p-6">
                  {!editedImageUrl && !isEditing ? (
                    <div className="flex flex-col items-center justify-center text-center px-2">
                      <div className="mb-3 sm:mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50"><svg className="h-7 w-7 sm:h-8 sm:w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg></div>
                      <h3 className="text-sm font-semibold text-slate-800">Your edited ad will appear here</h3>
                      <p className="mt-1 max-w-[360px] text-xs text-slate-500">Upload an ad, describe changes, then click Generate edit.</p>
                    </div>
                  ) : isEditing ? (
                    <div className="flex flex-col items-center justify-center text-center px-2">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50"><svg className="h-7 w-7 animate-spin text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg></div>
                      <p className="text-sm font-medium text-slate-700">Editing your ad…</p>
                      <p className="mt-1 text-xs text-slate-500">Generating edit prompt + rendering with Nano Banana 2</p>
                      <p className="mt-3 max-w-[280px] text-xs text-slate-500">Takes around 90 seconds. You can switch tabs or lock your phone – generation continues in the background.</p>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full max-w-lg rounded-xl overflow-hidden bg-slate-50 ring-1 ring-slate-200"><a href={editedImageUrl!} target="_blank" rel="noopener noreferrer" className="block"><img src={editedImageUrl!} alt="Edited ad" className="w-full h-auto object-contain" /></a></div>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                        <a href={editedImageUrl!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 min-h-[44px]"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Open</a>
                        <button type="button" onClick={() => handleDownloadImage(editedImageUrl!, 'edited-ad.jpg')} className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500 bg-sky-500 px-4 py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-sky-600 min-h-[44px] touch-manipulation"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {editPrompt && <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"><h3 className="text-sm font-semibold text-slate-900">Generated edit prompt</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{editPrompt}</p></div>}
            </div>
          </div>
        </>
          ) : activeTab === 'support' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm max-w-2xl">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Support</h1>
          <p className="mt-3 text-slate-600 leading-relaxed">
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
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-600"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            Chat with Founder
          </a>
        </div>
          ) : (
        <>
          {/* Replicate section header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl md:text-3xl">Replicate any static ad with your product</h1>
            <p className="mt-1.5 text-slate-600 sm:text-base md:text-lg">Upload a reference ad and your product image. We&apos;ll recreate it in seconds.</p>
          </div>

        <div className="grid grid-cols-1 items-start gap-5 sm:gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-4 sm:gap-5 lg:col-span-5">
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900 sm:text-base">1. Visual assets</h2>
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-medium text-sky-600 shrink-0">REQUIRED</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <input type="file" accept="image/*" onChange={handleStaticAdUpload} className="hidden" id="static-ad-upload" />
                  <label htmlFor="static-ad-upload" className="group relative flex aspect-[4/5] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl sm:rounded-2xl border-2 border-slate-200 bg-slate-50 transition-all hover:border-sky-300 hover:bg-sky-50/50 active:scale-[0.99]">
                    {staticAdPreview ? (
                      <div className="absolute inset-0 h-full w-full p-2"><img src={staticAdPreview} alt="Reference Ad" className="h-full w-full rounded-lg object-cover shadow-sm" /><div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"><span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-800 backdrop-blur-sm">Change</span></div></div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 sm:gap-3 text-center p-2 sm:p-4">
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white ring-1 ring-slate-200"><svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>
                        <div><p className="text-xs sm:text-sm font-medium text-slate-700">Reference Ad</p><p className="mt-0.5 text-[10px] sm:text-[11px] text-slate-500">Style to copy</p></div>
                      </div>
                    )}
                  </label>
                </div>
                <div>
                  <input type="file" accept="image/*" onChange={handleProductUpload} className="hidden" id="product-upload" />
                  <label htmlFor="product-upload" className="group relative flex aspect-[4/5] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl sm:rounded-2xl border-2 border-slate-200 bg-slate-50 transition-all hover:border-sky-300 hover:bg-sky-50/50 active:scale-[0.99]">
                    {productPreview ? (
                      <div className="absolute inset-0 h-full w-full p-2"><img src={productPreview} alt="Your Product" className="h-full w-full rounded-lg object-cover shadow-sm" /><div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"><span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-800 backdrop-blur-sm">Change</span></div></div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 sm:gap-3 text-center p-2 sm:p-4">
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white ring-1 ring-slate-200"><svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></div>
                        <div><p className="text-xs sm:text-sm font-medium text-slate-700">Your Product</p><p className="mt-0.5 text-[10px] sm:text-[11px] text-slate-500">PNG ideal</p></div>
                      </div>
                    )}
                  </label>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <label className="mb-2 block text-xs font-medium text-slate-600">Output size</label>
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value as ImageSizeOption)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
                >
                  {ASPECT_RATIO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.value === 'auto' && referenceAdDimensions ? `Auto (${referenceAdDimensions.width}×${referenceAdDimensions.height})` : opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-slate-500">{imageSize === 'auto' && referenceAdDimensions ? `Using aspect ratio from reference ad (${getResolvedAspectRatio()}).` : imageSize === 'auto' ? 'Match reference ad proportions (vertical by default).' : `Fixed aspect ratio: ${imageSize}.`}</p>
              </div>
            </section>
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-900 sm:text-base">2. Context</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500 shrink-0">OPTIONAL</span></div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Product URL</label>
                  <div className="relative">
                    <input type="url" value={copywriting} onChange={(e) => setCopywriting(e.target.value)} placeholder="https://your-store.com/product" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all min-h-[48px]" />
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  </div>
                  {copywriting.trim() && isValidUrl(copywriting.trim()) && <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600"><svg className="h-3.5 w-3.5 shrink-0" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>Page will be scraped for copy & branding</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Creative Guidelines</label>
                  <textarea value={guidelines} onChange={(e) => setGuidelines(e.target.value)} placeholder="e.g., Change the background to a sunny beach, remove all text overlays, make it moody..." rows={3} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all min-h-[88px]" />
                </div>
              </div>
            </section>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
              <button type="button" onClick={handleGenerate} disabled={!canGenerate || isGenerating} className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-sky-500 px-4 py-4 sm:py-3.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50 min-h-[52px] touch-manipulation">
                {isGenerating ? <><svg className="h-4 w-4 animate-spin text-white/90" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>{isScraping ? 'Analyzing URL...' : 'Generating Image...'}</span></> : <><span>Generate Image</span><svg className="h-4 w-4 text-white/90 transition-transform group-hover:translate-x-0.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></>}
              </button>
              {error && <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>{error}</p></div>}
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="sticky top-4 sm:top-8 flex min-h-[280px] sm:min-h-[380px] lg:min-h-[480px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Generated image</span>
                {generatedImageUrl && <a href={generatedImageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 min-h-[40px] items-center"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Open</a>}
              </div>
              <div className="relative flex flex-1 flex-col items-center justify-center p-4 sm:p-6 min-h-[240px] sm:min-h-[320px] lg:min-h-[380px]">
                {!generatedImageUrl && !isGenerating && !isGeneratingImage ? (
                  <div className="flex flex-col items-center justify-center text-center px-2">
                    <div className="mb-3 sm:mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50"><svg className="h-7 w-7 sm:h-8 sm:w-8 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>
                    <h3 className="text-sm font-semibold text-slate-800">Your ad will appear here</h3>
                    <p className="mt-1 max-w-[260px] text-xs text-slate-500">Upload both images and tap Generate Image.</p>
                  </div>
                ) : (isGenerating || isGeneratingImage) ? (
                  <div className="flex flex-col items-center justify-center text-center px-2">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50"><svg className="h-7 w-7 animate-spin text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg></div>
                    <p className="text-sm font-medium text-slate-700">Generating your ad…</p>
                    <p className="mt-1 text-xs text-slate-500">{isGeneratingImage ? 'Rendering with Nano Banana 2' : 'Preparing'}</p>
                    <p className="mt-3 max-w-[280px] text-xs text-slate-500">Takes around 90 seconds. You can switch tabs, lock your phone, or leave the app – generation continues in the background.</p>
                  </div>
                ) : generatedImageUrl ? (
                  <div className="w-full flex flex-col items-center">
                    <div className="w-full max-w-lg rounded-xl overflow-hidden bg-slate-50 ring-1 ring-slate-200">
                      <a href={generatedImageUrl} target="_blank" rel="noopener noreferrer" className="block"><img src={generatedImageUrl} alt="Generated ad" className="w-full h-auto object-contain" /></a>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                      <a href={generatedImageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 min-h-[44px]"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Open</a>
                      <button type="button" onClick={() => handleDownloadImage(generatedImageUrl, 'generated-ad.jpg')} className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500 bg-sky-500 px-4 py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-sky-600 min-h-[44px] touch-manipulation"><svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        </>
        )}
        </div>
      </div>
    </main>
  );
}
