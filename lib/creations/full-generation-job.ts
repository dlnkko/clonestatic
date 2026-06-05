import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdVisualMode } from '@/lib/ad-visual-mode';
import { internalJobHeaders, internalJobSecret } from '@/lib/internal-job';
import { runAdImageGenerationJob } from '@/lib/creations/generate-job';
import { productCopywritingPayload, rowToProduct } from '@/lib/products/db';
import type { ProductImage } from '@/lib/products/types';
import { getAppOrigin } from '@/lib/supabase/auth-config';

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

async function markCreationFailed(
  admin: SupabaseClient,
  creationId: string,
  userId: string,
  message: string
) {
  await admin
    .from('creations')
    .update({
      status: 'failed',
      error_message: message.slice(0, 2000),
    })
    .eq('id', creationId)
    .eq('user_id', userId);
}

async function scrapeCopywritingUrl(
  cookieHeader: string,
  url: string
): Promise<{ copywriting: string; isUrlScraped: true } | { error: string }> {
  try {
    const res = await fetch(`${getAppOrigin()}/api/scrape-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        ...internalJobHeaders(),
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
  userId: string,
  body: Record<string, unknown>
): Promise<
  | {
      prompt: string;
      adVisualMode: AdVisualMode;
      matchedProductImageUrls: string[];
      hasDedicatedLogo: boolean;
    }
  | { error: string }
> {
  try {
    const payload = { ...body };
    if (internalJobSecret()) {
      payload.internalUserId = userId;
    }

    const res = await fetch(`${getAppOrigin()}/api/generate-static-ad-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        ...internalJobHeaders(),
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      prompt?: string;
      adVisualMode?: AdVisualMode;
      matchedProductImageUrls?: string[];
      error?: string;
      details?: string;
    };
    if (!res.ok || !data.prompt) {
      const detail = [data.error, data.details].filter(Boolean).join(' — ');
      return { error: detail || `Prompt generation failed (HTTP ${res.status})` };
    }
    return {
      prompt: data.prompt,
      adVisualMode: data.adVisualMode === 'realistic' ? 'realistic' : 'design',
      matchedProductImageUrls: data.matchedProductImageUrls?.filter((u) => u.startsWith('http')) ?? [],
      hasDedicatedLogo: (data as { hasDedicatedLogo?: boolean }).hasDedicatedLogo === true,
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
    let productCatalogImages: ProductImage[] | undefined;
    let productDisplayName: string | undefined;

    if (copywritingUrl?.trim()) {
      const scraped = await scrapeCopywritingUrl(cookieHeader, copywritingUrl);
      if ('error' in scraped) {
        throw new Error(scraped.error);
      }
      copywritingResolved = scraped.copywriting;
      isUrlScraped = true;
    }

    if (productId) {
      const { data: row, error: prodErr } = await admin
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('user_id', userId)
        .single();
      if (prodErr || !row) {
        throw new Error('Product not found');
      }
      const savedProduct = rowToProduct(row as Record<string, unknown>);
      copywritingResolved = productCopywritingPayload(savedProduct);
      isUrlScraped = savedProduct.source === 'url' && !!savedProduct.scrape_cache;
      productCatalogImages = savedProduct.images;
      productDisplayName = savedProduct.name;
    }

    const promptBody: Record<string, unknown> = {
      referenceImageUrl,
      copywriting: copywritingResolved,
      isUrlScraped,
      guidelines: guidelines ?? null,
      copyLanguage,
    };
    if (productCatalogImages?.length) {
      promptBody.productCatalogImages = productCatalogImages;
      promptBody.productDisplayName = productDisplayName ?? 'Product';
    } else if (productImageUrl) {
      promptBody.productImageUrl = productImageUrl;
    }

    const promptResult = await generatePrompt(cookieHeader, userId, promptBody);
    if ('error' in promptResult) {
      throw new Error(promptResult.error);
    }

    await admin
      .from('creations')
      .update({ prompt: promptResult.prompt, error_message: null })
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
      hasDedicatedLogo: promptResult.hasDedicatedLogo,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    console.error('runFullAdGenerationJob failed:', message, err);
    await markCreationFailed(admin, creationId, userId, message);
  }
}
