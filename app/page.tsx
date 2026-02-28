'use client';

import { useState, useCallback } from 'react';

export type ImageSizeOption = '9:16' | '16:9' | '1:1' | 'auto';

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

  const isValidUrl = (string: string): boolean => {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  };

  const handleGenerate = async () => {
    if (!staticAdImage || !productImage) {
      setError('Please upload both the reference ad and your product image.');
      return;
    }

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

      const response = await fetch('/api/generate-static-ad-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staticAdImage: staticAdBase64,
          productImage: productBase64,
          copywriting: copywritingInput || null,
          isUrlScraped: isUrl,
          guidelines: guidelines.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate prompt.');
      }

      setGeneratedPrompt(data.prompt);
      setCostInfo(data.cost || null);

      // Call Kie.ai to generate the ad image (nano-banana-2) using the prompt and product image
      setIsGeneratingImage(true);
      try {
        const imgRes = await fetch('/api/generate-ad-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: data.prompt,
            productImageBase64: productBase64,
            aspectRatio: getResolvedAspectRatio(),
          }),
        });
        const imgData = await imgRes.json();
        if (imgRes.ok && imgData.imageUrl) {
          setGeneratedImageUrl(imgData.imageUrl);
        } else if (!imgRes.ok) {
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

  const handleDownloadImage = async () => {
    if (!generatedImageUrl) return;
    try {
      const res = await fetch(generatedImageUrl, { mode: 'cors' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated-ad.jpg';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(generatedImageUrl, '_blank');
    }
  };

  /** Resolve aspect ratio for API: when "auto", use reference ad dimensions to pick 9:16, 16:9, or 1:1; otherwise use selected size. */
  const getResolvedAspectRatio = useCallback((): string => {
    if (imageSize !== 'auto') return imageSize;
    if (!referenceAdDimensions) return '9:16'; // auto without reference → vertical like typical reference ad
    const { width: w, height: h } = referenceAdDimensions;
    const ratio = w / h;
    if (ratio < 0.85) return '9:16';
    if (ratio > 1.2) return '16:9';
    return '1:1';
  }, [imageSize, referenceAdDimensions]);

  const canGenerate = staticAdImage && productImage;

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-[1200px] px-6 py-12 lg:py-20">
        
        {/* Header */}
        <header className="mb-12 lg:mb-16 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                Ad Prompt Generator
              </h1>
              <p className="text-sm text-zinc-500">
                Reverse engineer static ads into AI prompts
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-16">
          
          {/* Left Column: Input Form */}
          <div className="flex flex-col gap-8 lg:col-span-5">
            
            {/* Section 1: Images */}
            <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">1. Visual Assets</h2>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-600">REQUIRED</span>
              </div>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Reference Ad Upload */}
                <div>
                  <input type="file" accept="image/*" onChange={handleStaticAdUpload} className="hidden" id="static-ad-upload" />
                  <label
                    htmlFor="static-ad-upload"
                    className="group relative flex aspect-[4/5] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/50 transition-all hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    {staticAdPreview ? (
                      <div className="absolute inset-0 h-full w-full p-2">
                        <img src={staticAdPreview} alt="Reference Ad" className="h-full w-full rounded-xl object-cover shadow-sm" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">Change</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-center p-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-zinc-200">
                          <svg className="h-5 w-5 text-zinc-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-700">Reference Ad</p>
                          <p className="mt-1 text-[11px] text-zinc-500">The style to copy</p>
                        </div>
                      </div>
                    )}
                  </label>
                </div>

                {/* Product Upload */}
                <div>
                  <input type="file" accept="image/*" onChange={handleProductUpload} className="hidden" id="product-upload" />
                  <label
                    htmlFor="product-upload"
                    className="group relative flex aspect-[4/5] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/50 transition-all hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    {productPreview ? (
                      <div className="absolute inset-0 h-full w-full p-2">
                        <img src={productPreview} alt="Your Product" className="h-full w-full rounded-xl object-cover shadow-sm" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">Change</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-center p-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-zinc-200">
                          <svg className="h-5 w-5 text-zinc-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-700">Your Product</p>
                          <p className="mt-1 text-[11px] text-zinc-500">Transparent PNG ideal</p>
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Output size */}
              <div className="pt-4 border-t border-zinc-100">
                <label className="mb-2 block text-xs font-medium text-zinc-600">Output size</label>
                <div className="flex flex-wrap gap-2">
                  {(['9:16', '16:9', '1:1', 'auto'] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setImageSize(size)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                        imageSize === size
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      {size === '9:16' && 'Vertical 9:16'}
                      {size === '16:9' && 'Horizontal 16:9'}
                      {size === '1:1' && 'Square 1:1'}
                      {size === 'auto' && (referenceAdDimensions ? `Auto (${referenceAdDimensions.width}×${referenceAdDimensions.height})` : 'Auto (match reference)')}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  {imageSize === 'auto' && referenceAdDimensions
                    ? `Using aspect ratio from reference ad (${getResolvedAspectRatio()}).`
                    : imageSize === 'auto'
                    ? 'Match reference ad proportions (vertical by default).'
                    : `Fixed aspect ratio: ${imageSize}.`}
                </p>
              </div>
            </section>

            {/* Section 2: Context */}
            <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">2. Context</h2>
                <span className="rounded-full bg-zinc-50 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-400">OPTIONAL</span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-600">Product URL</label>
                  <div className="relative">
                    <input
                      type="url"
                      value={copywriting}
                      onChange={(e) => setCopywriting(e.target.value)}
                      placeholder="https://your-store.com/product"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 pl-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all"
                    />
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  </div>
                  {copywriting.trim() && isValidUrl(copywriting.trim()) && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
                      <svg className="h-3.5 w-3.5 text-emerald-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
                      Page will be scraped for copy & branding
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-600">Creative Guidelines</label>
                  <textarea
                    value={guidelines}
                    onChange={(e) => setGuidelines(e.target.value)}
                    placeholder="e.g., Change the background to a sunny beach, remove all text overlays, make it moody..."
                    rows={3}
                    className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all"
                  />
                </div>
              </div>
            </section>

            {/* Action */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-zinc-900 px-4 py-3.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] ring-1 ring-inset ring-zinc-900 transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-zinc-900"
              >
                {isGenerating ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>{isScraping ? 'Analyzing URL...' : 'Generating Image...'}</span>
                  </>
                ) : (
                  <>
                    <span>Generate Image</span>
                    <svg className="h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-0.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </>
                )}
              </button>

              {error && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p>{error}</p>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Generated Image Only */}
          <div className="lg:col-span-7">
            <div className="sticky top-8 flex min-h-[520px] flex-col overflow-hidden rounded-2xl border-2 border-zinc-200 bg-zinc-100 shadow-xl">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Generated image</span>
                {generatedImageUrl && (
                  <a
                    href={generatedImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm transition hover:bg-zinc-50 hover:border-zinc-300"
                  >
                    <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    Open
                  </a>
                )}
              </div>

              {/* Content */}
              <div className="relative flex flex-1 flex-col items-center justify-center p-6 min-h-[400px]">
                {!generatedImageUrl && !isGenerating && !isGeneratingImage ? (
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-white">
                      <svg className="h-10 w-10 text-zinc-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-700">Your ad will appear here</h3>
                    <p className="mt-1 max-w-[240px] text-xs text-zinc-500">
                      Upload your assets and click Generate Image.
                    </p>
                  </div>
                ) : (isGenerating || isGeneratingImage) ? (
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-zinc-200 bg-white">
                      <svg className="h-7 w-7 animate-spin text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    </div>
                    <p className="text-sm font-medium text-zinc-600">Generating your ad…</p>
                    <p className="mt-1 text-xs text-zinc-500">{isGeneratingImage ? 'Rendering with Nano Banana 2' : 'Preparing'}</p>
                  </div>
                ) : generatedImageUrl ? (
                  <div className="w-full flex flex-col items-center">
                    <div className="w-full max-w-lg rounded-xl overflow-hidden bg-white shadow-lg ring-1 ring-zinc-200/80">
                      <a href={generatedImageUrl} target="_blank" rel="noopener noreferrer" className="block">
                        <img
                          src={generatedImageUrl}
                          alt="Generated ad"
                          className="w-full h-auto object-contain"
                        />
                      </a>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <a
                        href={generatedImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm transition hover:bg-zinc-50 hover:border-zinc-300"
                      >
                        <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        Open
                      </a>
                      <button
                        type="button"
                        onClick={handleDownloadImage}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-zinc-800"
                      >
                        <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Download
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

            </div>
          </div>
          
        </div>
      </div>
    </main>
  );
}
