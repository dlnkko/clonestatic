import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rowToProduct } from '@/lib/products/db';
import { resolveProductImageSlots, type ProductImageSlotInput } from '@/lib/products/save-product-images';
import type { ProductScrapeCache } from '@/lib/products/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ product: rowToProduct(data as Record<string, unknown>) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      target_audience,
      color_palette,
      priceDisplay,
      pricingConfig,
      scrape_cache,
      imageSlots,
    } = body as {
      name?: string;
      description?: string;
      target_audience?: string;
      color_palette?: { colors?: string[]; notes?: string } | string;
      priceDisplay?: string | null;
      pricingConfig?: ProductScrapeCache['pricingConfig'];
      scrape_cache?: ProductScrapeCache;
      imageSlots?: ProductImageSlotInput[];
    };

    const { data: existing, error: fetchErr } = await supabase
      .from('products')
      .select('name, scrape_cache')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof name === 'string' && name.trim()) updates.name = name.trim().slice(0, 200);
    if (typeof description === 'string') updates.description = description.trim().slice(0, 4000) || null;
    if (typeof target_audience === 'string') {
      updates.target_audience = target_audience.trim().slice(0, 1000) || null;
    }
    if (color_palette != null) {
      if (typeof color_palette === 'string') {
        const colors = color_palette
          .split(/[,;\n]+/)
          .map((c) => c.trim())
          .filter(Boolean);
        updates.color_palette = colors.length ? { colors } : null;
      } else {
        updates.color_palette = color_palette;
      }
    }

    let cache = (existing.scrape_cache as ProductScrapeCache) || null;
    if (scrape_cache && typeof scrape_cache === 'object') {
      cache = { ...cache, ...scrape_cache } as ProductScrapeCache;
    }
    if (priceDisplay !== undefined && cache) {
      cache = { ...cache, priceDisplay: priceDisplay?.trim() || null };
    }
    if (pricingConfig !== undefined && cache) {
      cache = { ...cache, pricingConfig };
    }
    if (cache) updates.scrape_cache = cache;

    if (Array.isArray(imageSlots)) {
      if (imageSlots.length < 1) {
        return NextResponse.json({ error: 'At least one product image is required' }, { status: 400 });
      }
      const logoCount = imageSlots.filter((s) => s.kind === 'logo').length;
      const productCount = imageSlots.length - logoCount;
      if (productCount < 1) {
        return NextResponse.json({ error: 'At least one product image is required' }, { status: 400 });
      }
      if (productCount > 10) {
        return NextResponse.json({ error: 'Maximum 10 product images' }, { status: 400 });
      }
      if (logoCount > 2) {
        return NextResponse.json({ error: 'Maximum 2 logo images' }, { status: 400 });
      }
      const productName =
        (typeof name === 'string' && name.trim()) ||
        String(existing.name || 'Product');
      try {
        const resolved = await resolveProductImageSlots(imageSlots, productName);
        updates.images = resolved.images;
        updates.primary_image_url = resolved.primary_image_url;
        updates.logo_url = resolved.logo_url;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to update images';
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product: rowToProduct(data as Record<string, unknown>) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { error } = await supabase.from('products').delete().eq('id', id).eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
