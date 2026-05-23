import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadBase64ToImgBB } from '@/lib/imgbb';
import { rowToProduct } from '@/lib/products/db';
import { scrapeProductPage } from '@/lib/products/scrape';
import type { ProductImage, ProductScrapeCache } from '@/lib/products/types';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      products: (data ?? []).map((row) => rowToProduct(row as Record<string, unknown>)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list products';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type CreateManualBody = {
  source: 'manual';
  name: string;
  description: string;
  targetAudience: string;
  colorPalette: string;
  logoBase64?: string;
  imageBase64List: string[];
};

type CreateUrlBody = {
  source: 'url';
  productUrl: string;
  name?: string;
};

type CreateUrlFromPreviewBody = {
  source: 'url';
  saveFromPreview: true;
  productUrl: string;
  name: string;
  description?: string;
  targetAudience?: string;
  colorPalette?: string;
  priceDisplay?: string;
  summary: string;
  markdown?: string | null;
  branding?: Record<string, unknown> | null;
  extractedPricing?: ProductScrapeCache['extractedPricing'];
  images: ProductImage[];
};

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

    const body = await request.json();
    const source = body?.source as string;

    if (source === 'url' && body.saveFromPreview) {
      const b = body as CreateUrlFromPreviewBody;
      if (!b.productUrl?.trim() || !b.name?.trim() || !Array.isArray(b.images) || b.images.length < 1) {
        return NextResponse.json({ error: 'Invalid preview save payload' }, { status: 400 });
      }

      const imageUrls: ProductImage[] = [];
      for (const img of b.images.slice(0, 12)) {
        try {
          const res = await fetch(img.url, { signal: AbortSignal.timeout(20000) });
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          const b64 = `data:${res.headers.get('content-type')?.split(';')[0] || 'image/jpeg'};base64,${buf.toString('base64')}`;
          const hosted = await uploadBase64ToImgBB(b64);
          imageUrls.push({ ...img, url: hosted });
        } catch {
          imageUrls.push(img);
        }
      }

      const primary = imageUrls[0]?.url;
      if (!primary) {
        return NextResponse.json({ error: 'No images to save' }, { status: 400 });
      }

      const colors = b.colorPalette
        ?.split(/[,;\n]+/)
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 8);

      const scrapeCache: ProductScrapeCache = {
        summary: b.summary,
        branding: b.branding ?? null,
        markdown: b.markdown ?? null,
        scrapedAt: new Date().toISOString(),
        productUrl: b.productUrl.trim(),
        extractedPricing: b.extractedPricing,
        priceDisplay: b.priceDisplay?.trim() || null,
      };

      const { data, error } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          name: b.name.trim().slice(0, 200),
          source: 'url',
          product_url: b.productUrl.trim(),
          description: (b.description || b.summary).trim().slice(0, 4000),
          target_audience: b.targetAudience?.trim().slice(0, 1000) || null,
          color_palette: colors?.length ? { colors } : null,
          logo_url: null,
          primary_image_url: primary,
          images: imageUrls,
          scrape_cache: scrapeCache,
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ product: rowToProduct(data as Record<string, unknown>) });
    }

    if (source === 'url') {
      const { productUrl, name: nameOverride } = body as CreateUrlBody;
      if (!productUrl?.trim()) {
        return NextResponse.json({ error: 'productUrl is required' }, { status: 400 });
      }
      try {
        new URL(productUrl);
      } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
      }

      const scraped = await scrapeProductPage(productUrl.trim());
      const imageUrls: ProductImage[] = [];
      for (const img of scraped.images.slice(0, 12)) {
        try {
          const res = await fetch(img.url, { signal: AbortSignal.timeout(20000) });
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          const b64 = `data:${res.headers.get('content-type')?.split(';')[0] || 'image/jpeg'};base64,${buf.toString('base64')}`;
          const hosted = await uploadBase64ToImgBB(b64);
          imageUrls.push({ ...img, url: hosted });
        } catch {
          // keep original URL if upload fails
          imageUrls.push(img);
        }
      }

      const primary = imageUrls[0]?.url;
      if (!primary) {
        return NextResponse.json(
          { error: 'No product images found on page. Try manual entry.' },
          { status: 400 }
        );
      }

      const scrapeCache: ProductScrapeCache = {
        summary: scraped.summary,
        branding: scraped.branding,
        markdown: scraped.markdown,
        scrapedAt: new Date().toISOString(),
        productUrl: productUrl.trim(),
        extractedPricing: scraped.extractedPricing,
        priceDisplay:
          scraped.extractedPricing.salePrice ?? scraped.extractedPricing.regularPrice ?? null,
      };

      const productName =
        nameOverride?.trim() ||
        (scraped.metadata?.title as string) ||
        (scraped.metadata?.ogTitle as string) ||
        'Product';

      const colorPalette = scraped.branding?.colors
        ? { colors: Object.values(scraped.branding.colors as Record<string, string>).filter(Boolean) }
        : null;

      const { data, error } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          name: productName.slice(0, 200),
          source: 'url',
          product_url: productUrl.trim(),
          description: scraped.summary.slice(0, 4000),
          target_audience: null,
          color_palette: colorPalette,
          logo_url: null,
          primary_image_url: primary,
          images: imageUrls,
          scrape_cache: scrapeCache,
        })
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ product: rowToProduct(data as Record<string, unknown>) });
    }

    if (source === 'manual') {
      const {
        name,
        description,
        targetAudience,
        colorPalette,
        priceDisplay,
        logoBase64,
        imageBase64List,
      } = body as CreateManualBody & { priceDisplay?: string };

      if (!name?.trim()) {
        return NextResponse.json({ error: 'name is required' }, { status: 400 });
      }
      if (!Array.isArray(imageBase64List) || imageBase64List.length < 1) {
        return NextResponse.json({ error: 'At least one product image is required' }, { status: 400 });
      }
      if (imageBase64List.length > 3) {
        return NextResponse.json({ error: 'Maximum 3 product images' }, { status: 400 });
      }

      const images: ProductImage[] = [];
      for (let i = 0; i < imageBase64List.length; i++) {
        const url = await uploadBase64ToImgBB(imageBase64List[i]);
        images.push({
          url,
          kind: i === 0 ? 'product' : 'other',
          alt: `${name.trim()} image ${i + 1}`,
        });
      }

      let logoUrl: string | null = null;
      if (logoBase64) {
        logoUrl = await uploadBase64ToImgBB(logoBase64);
        images.push({ url: logoUrl, kind: 'logo', alt: `${name.trim()} logo` });
      }

      const colors = colorPalette
        ?.split(/[,;\n]+/)
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 8);

      const manualCache: ProductScrapeCache | null = priceDisplay?.trim()
        ? {
            summary: description?.trim() || name.trim(),
            branding: null,
            markdown: null,
            scrapedAt: new Date().toISOString(),
            priceDisplay: priceDisplay.trim(),
          }
        : null;

      const { data, error } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          name: name.trim().slice(0, 200),
          source: 'manual',
          product_url: null,
          description: description?.trim().slice(0, 4000) || null,
          target_audience: targetAudience?.trim().slice(0, 1000) || null,
          color_palette: colors?.length ? { colors } : null,
          logo_url: logoUrl,
          primary_image_url: images[0].url,
          images,
          scrape_cache: manualCache,
        })
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ product: rowToProduct(data as Record<string, unknown>) });
    }

    return NextResponse.json({ error: 'source must be "url" or "manual"' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
