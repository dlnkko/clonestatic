import { NextRequest, NextResponse } from 'next/server';
import { errorMessageFromUnknown, userMessageForProductScrape } from '@/lib/api-error-message';
import { refreshProductPageScrape } from '@/lib/products/refresh-page-scrape';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Re-scrape the saved product URL and refresh page copy (summary, markdown, branding). */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResult = await checkRateLimit('scrapeUrl', _request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: userMessageForProductScrape(429) }, { status: 429 });
    }

    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: userMessageForProductScrape(401) }, { status: 401 });
    }

    if (!process.env.FIRECRAWL_API_KEY?.trim()) {
      return NextResponse.json({ error: userMessageForProductScrape(503) }, { status: 503 });
    }

    const product = await refreshProductPageScrape(supabase, id, user.id);
    return NextResponse.json({ product });
  } catch (err) {
    const message = errorMessageFromUnknown(err);
    console.error('[products/resync]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
