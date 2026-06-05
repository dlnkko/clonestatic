import { NextRequest, NextResponse } from 'next/server';
import { errorMessageFromUnknown, userMessageForProductScrape } from '@/lib/api-error-message';
import { createClient } from '@/lib/supabase/server';
import { scrapeProductPage } from '@/lib/products/scrape';
import { pricingConfigFromExtracted } from '@/lib/products/pricing-config';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Scrape product URL without saving — for review/edit before create. */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit('scrapeUrl', request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: userMessageForProductScrape(429) }, { status: 429 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: userMessageForProductScrape(401) }, { status: 401 });
    }

    const { productUrl } = (await request.json()) as { productUrl?: string };
    if (!productUrl?.trim()) {
      return NextResponse.json({ error: userMessageForProductScrape(400) }, { status: 400 });
    }

    try {
      new URL(productUrl.trim());
    } catch {
      return NextResponse.json({ error: userMessageForProductScrape(400) }, { status: 400 });
    }

    if (!process.env.FIRECRAWL_API_KEY?.trim()) {
      console.error('[preview-scrape] FIRECRAWL_API_KEY is not set');
      return NextResponse.json({ error: userMessageForProductScrape(503) }, { status: 503 });
    }

    const scraped = await scrapeProductPage(productUrl.trim());
    const extractedPricing = scraped.extractedPricing;
    const pricingConfig = pricingConfigFromExtracted(extractedPricing);

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
        logoUrl: scraped.logoUrl,
        extractedPricing,
        priceDisplay: pricingConfig.priceDisplay ?? '',
        pricingConfig,
      },
    });
  } catch (err) {
    console.error('[preview-scrape]', errorMessageFromUnknown(err));
    return NextResponse.json({ error: userMessageForProductScrape(500) }, { status: 500 });
  }
}
