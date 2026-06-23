import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadBase64ToImgBB } from '@/lib/imgbb';
import { rowToProduct } from '@/lib/products/db';
import { classifyProductImagesHeuristic } from '@/lib/products/classify-images';
import { primaryProductImageUrl } from '@/lib/products/prepare-catalog';
import { scrapeProductPage } from '@/lib/products/scrape';
import type { ProductImage, ProductScrapeCache } from '@/lib/products/types';
import { checkRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertCanAddProduct } from '@/lib/subscription-limits';
import { buildScrapeCacheFromPageScrape } from '@/lib/products/build-scrape-cache';
import { pageDescriptionFromMetadata } from '@/lib/products/compare-scrape-cache';
import { hostExternalImageUrls } from '@/lib/products/host-scraped-image';

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
  logoBase64List?: string[];
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
  pricingConfig?: ProductScrapeCache['pricingConfig'];
  logoBase64List?: string[];
  imageBase64List?: string[];
  selectedLogoUrls?: string[];
  selectedProductUrls?: string[];
  branding?: Record<string, unknown> | null;
  extractedPricing?: ProductScrapeCache['extractedPricing'];
  markdown?: string | null;
  scrapeSummary?: string | null;
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

    const admin = createAdminClient();
    const productLimit = await assertCanAddProduct(admin, user.id, user.email ?? '');
    if (!productLimit.ok) {
      return NextResponse.json(
        {
          error: productLimit.message,
          code: 'PRODUCT_LIMIT',
          maxProducts: productLimit.maxProducts,
          productCount: productLimit.productCount,
        },
        { status: 403 }
      );
    }

    if (source === 'url' && body.saveFromPreview) {
      const b = body as CreateUrlFromPreviewBody;
      if (!b.productUrl?.trim() || !b.name?.trim()) {
        return NextResponse.json({ error: 'Invalid preview save payload' }, { status: 400 });
      }

      const productUrlList = Array.isArray(b.selectedProductUrls)
        ? b.selectedProductUrls.filter((u) => typeof u === 'string' && u.trim())
        : [];
      const logoUrlList = Array.isArray(b.selectedLogoUrls)
        ? b.selectedLogoUrls.filter((u) => typeof u === 'string' && u.trim()).slice(0, 2)
        : [];
      const base64Products = Array.isArray(b.imageBase64List) ? b.imageBase64List : [];
      const base64Logos = Array.isArray(b.logoBase64List) ? b.logoBase64List : [];

      if (productUrlList.length + base64Products.length < 1) {
        return NextResponse.json({ error: 'Select or upload at least one product image' }, { status: 400 });
      }
      if (productUrlList.length + base64Products.length > 10) {
        return NextResponse.json({ error: 'Maximum 10 product images' }, { status: 400 });
      }

      const images: ProductImage[] = [];

      const hostedProducts = await hostExternalImageUrls(productUrlList.slice(0, 10));
      for (let i = 0; i < hostedProducts.length; i++) {
        images.push({
          url: hostedProducts[i],
          kind: i === 0 ? 'product' : 'packaging',
          alt: `${b.name.trim()} image ${i + 1}`,
        });
      }


      for (let i = 0; i < base64Products.length; i++) {
        const nonLogoCount = images.filter((img) => img.kind !== 'logo').length;
        if (nonLogoCount >= 10) break;
        const url = await uploadBase64ToImgBB(base64Products[i]);
        images.push({
          url,
          kind: nonLogoCount === 0 ? 'product' : 'packaging',
          alt: `${b.name.trim()} image ${nonLogoCount + 1}`,
        });
      }

      const logoUrls: string[] = [];
      const hostedLogos = await hostExternalImageUrls(logoUrlList);
      for (const url of hostedLogos) {
        logoUrls.push(url);
        images.push({ url, kind: 'logo', alt: `${b.name.trim()} logo` });
      }
      for (const base64 of base64Logos.slice(0, 2)) {
        if (!base64) continue;
        const url = await uploadBase64ToImgBB(base64);
        logoUrls.push(url);
        images.push({ url, kind: 'logo', alt: `${b.name.trim()} logo` });
      }

      const classifiedImages = classifyProductImagesHeuristic(images);
      const primary = primaryProductImageUrl(classifiedImages);
      if (!primary) {
        return NextResponse.json({ error: 'No images to save' }, { status: 400 });
      }

      const colors = b.colorPalette
        ?.split(/[,;\n]+/)
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 8);

      const mergedImages = classifiedImages;

      const scrapeCache: ProductScrapeCache = {
        summary: (b.scrapeSummary || b.description || b.name).trim(),
        branding: b.branding ?? null,
        markdown: b.markdown?.trim() ? b.markdown.trim().slice(0, 12000) : null,
        scrapedAt: new Date().toISOString(),
        productUrl: b.productUrl.trim(),
        extractedPricing: b.extractedPricing,
        priceDisplay: b.priceDisplay?.trim() || b.pricingConfig?.priceDisplay?.trim() || null,
        pricingConfig: b.pricingConfig ?? undefined,
      };

      const { data, error } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          name: b.name.trim().slice(0, 200),
          source: 'url',
          product_url: b.productUrl.trim(),
          description: (b.description || '').trim().slice(0, 4000) || null,
          target_audience: b.targetAudience?.trim().slice(0, 1000) || null,
          color_palette: colors?.length ? { colors } : null,
          logo_url: logoUrls[0] ?? null,
          primary_image_url: primary,
          images: mergedImages,
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
      for (const img of scraped.images.slice(0, 10)) {
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

      const classifiedUrls = classifyProductImagesHeuristic(imageUrls);
      const productImages = classifiedUrls.filter((i) => i.kind !== 'logo');
      const logoImages = classifiedUrls.filter((i) => i.kind === 'logo');
      const mergedForSave = [...productImages, ...logoImages];

      const primary = productImages[0]?.url ?? mergedForSave[0]?.url;
      if (!primary) {
        return NextResponse.json(
          { error: 'No product images found on page. Try manual entry.' },
          { status: 400 }
        );
      }

      const scrapeCache = buildScrapeCacheFromPageScrape(scraped, productUrl.trim());

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
          description: pageDescriptionFromMetadata(scraped.metadata).slice(0, 4000) || null,
          target_audience: null,
          color_palette: colorPalette,
          logo_url: logoImages[0]?.url ?? scraped.logoUrl ?? null,
          primary_image_url: primary,
          images: mergedForSave,
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
        logoBase64List,
        imageBase64List,
      } = body as CreateManualBody & {
        priceDisplay?: string;
        pricingConfig?: ProductScrapeCache['pricingConfig'];
      };

      if (!name?.trim()) {
        return NextResponse.json({ error: 'name is required' }, { status: 400 });
      }
      if (!Array.isArray(imageBase64List) || imageBase64List.length < 1) {
        return NextResponse.json({ error: 'At least one product image is required' }, { status: 400 });
      }
      if (imageBase64List.length > 10) {
        return NextResponse.json({ error: 'Maximum 10 product images' }, { status: 400 });
      }

      const images: ProductImage[] = [];
      for (let i = 0; i < imageBase64List.length; i++) {
        const url = await uploadBase64ToImgBB(imageBase64List[i]);
        images.push({
          url,
          kind: i === 0 ? 'product' : 'packaging',
          alt: `${name.trim()} image ${i + 1}`,
        });
      }

      const logoUrls: string[] = [];
      if (Array.isArray(logoBase64List)) {
        for (const base64 of logoBase64List.slice(0, 2)) {
          if (!base64) continue;
          const url = await uploadBase64ToImgBB(base64);
          logoUrls.push(url);
          images.push({ url, kind: 'logo', alt: `${name.trim()} logo` });
        }
      }

      const classifiedImages = classifyProductImagesHeuristic(images);

      const colors = colorPalette
        ?.split(/[,;\n]+/)
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 8);

      const manualCache: ProductScrapeCache | null =
        priceDisplay?.trim() || body.pricingConfig
          ? {
              summary: description?.trim() || name.trim(),
              branding: null,
              markdown: null,
              scrapedAt: new Date().toISOString(),
              priceDisplay: priceDisplay?.trim() || body.pricingConfig?.priceDisplay?.trim() || null,
              pricingConfig: body.pricingConfig ?? undefined,
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
          logo_url: logoUrls[0] ?? null,
          primary_image_url: primaryProductImageUrl(classifiedImages) ?? classifiedImages[0].url,
          images: classifiedImages,
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
