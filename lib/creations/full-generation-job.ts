import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdVisualMode } from '@/lib/ad-visual-mode';
import { runAdImageGenerationJob } from '@/lib/creations/generate-job';

export type FullAdGenerationParams = {
  creationId: string;
  userId: string;
  admin: SupabaseClient;
  cookieHeader: string;
  referenceImageUrl: string;
  productImageUrl?: string | null;
  productImageUrls?: string[];
  productId?: string | null;
  copywriting?: string | null;
  /** When set, scrape this URL server-side before prompt generation. */
  copywritingUrl?: string | null;
  guidelines?: string | null;
  copyLanguage?: string;
  aspectRatio: string;
};

function appOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

async function scrapeCopywritingUrl(
  cookieHeader: string,
  url: string
): Promise<{ copywriting: string; isUrlScraped: true } | { error: string }> {
  try {
    const res = await fetch(`${appOrigin()}/api/scrape-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ url: url.trim() }),
    });
    const data = (await res.json()) as {
      summary?: string;
      branding?: unknown;
      markdown?: string;
      error?: string;
      details?: string;
    };
    if (!res.ok || !data.summary) {
      return { error: data.error || data.details || 'Could not scrape product URL.' };
    }
    return {
      copywriting: JSON.stringify({
        summary: data.summary,
        branding: data.branding ?? null,
        markdown: data.markdown ?? null,
      }),
      isUrlScraped: true,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Scrape failed' };
  }
}

async function generatePrompt(
  cookieHeader: string,
  body: Record<string, unknown>
): Promise<
  | {
      prompt: string;
      adVisualMode: AdVisualMode;
      matchedProductImageUrls: string[];
    }
  | { error: string }
> {
  try {
    const res = await fetch(`${appOrigin()}/api/generate-static-ad-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      prompt?: string;
      adVisualMode?: AdVisualMode;
      matchedProductImageUrls?: string[];
      error?: string;
      details?: string;
    };
    if (!res.ok || !data.prompt) {
      return { error: data.error || data.details || 'Prompt generation failed' };
    }
    return {
      prompt: data.prompt,
      adVisualMode: data.adVisualMode === 'realistic' ? 'realistic' : 'design',
      matchedProductImageUrls: data.matchedProductImageUrls?.filter((u) => u.startsWith('http')) ?? [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Prompt generation failed' };
  }
}

export async function runFullAdGenerationJob(params: FullAdGenerationParams): Promise<void> {
  const {
    creationId,
    userId,
    admin,
    cookieHeader,
    referenceImageUrl,
    productImageUrl,
    productImageUrls: productImageUrlsParam,
    productId,
    copywriting,
    copywritingUrl,
    guidelines,
    copyLanguage,
    aspectRatio,
  } = params;

  try {
    let copywritingResolved = copywriting ?? null;
    let isUrlScraped = false;

    if (copywritingUrl?.trim()) {
      const scraped = await scrapeCopywritingUrl(cookieHeader, copywritingUrl);
      if ('error' in scraped) {
        throw new Error(scraped.error);
      }
      copywritingResolved = scraped.copywriting;
      isUrlScraped = true;
    }

    const promptBody: Record<string, unknown> = {
      referenceImageUrl,
      copywriting: copywritingResolved,
      isUrlScraped,
      guidelines: guidelines ?? null,
      copyLanguage,
    };
    if (productId) {
      promptBody.productId = productId;
    } else if (productImageUrl) {
      promptBody.productImageUrl = productImageUrl;
    }

    const promptResult = await generatePrompt(cookieHeader, promptBody);
    if ('error' in promptResult) {
      throw new Error(promptResult.error);
    }

    await admin
      .from('creations')
      .update({ prompt: promptResult.prompt })
      .eq('id', creationId)
      .eq('user_id', userId);

    let productImageUrls = promptResult.matchedProductImageUrls;
    if (productImageUrls.length === 0 && productImageUrlsParam?.length) {
      productImageUrls = productImageUrlsParam;
    }
    if (productImageUrls.length === 0 && productImageUrl) {
      productImageUrls = [productImageUrl];
    }
    if (productImageUrls.length === 0) {
      throw new Error('No product images available for generation');
    }

    await runAdImageGenerationJob({
      prompt: promptResult.prompt,
      productImageUrls,
      referenceImageUrl,
      aspectRatio,
      adVisualMode: promptResult.adVisualMode,
      creationId,
      userId,
      admin,
    });
  } catch (err) {
    console.error('runFullAdGenerationJob failed:', err);
    await admin
      .from('creations')
      .update({ status: 'failed' })
      .eq('id', creationId)
      .eq('user_id', userId);
  }
}
