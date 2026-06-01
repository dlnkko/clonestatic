import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractPricingFromText } from '@/lib/products/extract-pricing';
import { scrapeProductPage } from '@/lib/products/scrape';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Scrape product URL without saving — for review/edit before create. */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit('scrapeUrl', request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { productUrl } = (await request.json()) as { productUrl?: string };
    if (!productUrl?.trim()) {
      return NextResponse.json({ error: 'productUrl is required' }, { status: 400 });
    }

    const scraped = await scrapeProductPage(productUrl.trim());
    // Keep preview lean: no page markdown/body dump in UI.
    const pricingText = [scraped.summary].filter(Boolean).join('\n');
    const extractedPricing = extractPricingFromText(pricingText);

    const productName =
      (scraped.metadata?.title as string) ||
      (scraped.metadata?.ogTitle as string) ||
      'Product';

    const colorPalette = scraped.branding?.colors
      ? {
          colors: Object.values(scraped.branding.colors as Record<string, string>).filter(
            Boolean
          ),
        }
      : null;

    return NextResponse.json({
      preview: {
        productUrl: productUrl.trim(),
        name: productName,
        description: scraped.summary,
        targetAudience: '',
        colorPalette: colorPalette?.colors?.join(', ') ?? '',
        branding: scraped.branding,
        images: scraped.images,
        extractedPricing,
        priceDisplay: extractedPricing.salePrice ?? extractedPricing.regularPrice ?? '',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scrape failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
