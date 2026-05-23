import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rowToProduct } from '@/lib/products/db';
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
      scrape_cache,
    } = body as {
      name?: string;
      description?: string;
      target_audience?: string;
      color_palette?: { colors?: string[]; notes?: string } | string;
      priceDisplay?: string | null;
      scrape_cache?: ProductScrapeCache;
    };

    const { data: existing, error: fetchErr } = await supabase
      .from('products')
      .select('scrape_cache')
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
    if (cache) updates.scrape_cache = cache;

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
