import type { SupabaseClient } from '@supabase/supabase-js';
import { rowToProduct } from '@/lib/products/db';
import { buildScrapeCacheFromPageScrape } from '@/lib/products/build-scrape-cache';
import { scrapeProductPage } from '@/lib/products/scrape';
import type { ProductRecord } from '@/lib/products/types';

/** Re-scrape product page text (summary, branding, markdown, pricing) and update scrape_cache. */
export async function refreshProductPageScrape(
  supabase: SupabaseClient,
  productId: string,
  userId: string
): Promise<ProductRecord> {
  const { data: row, error: fetchErr } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('user_id', userId)
    .single();

  if (fetchErr || !row) {
    throw new Error('Product not found');
  }

  const product = rowToProduct(row as Record<string, unknown>);
  const url = product.product_url?.trim();
  if (!url) {
    throw new Error('This product has no URL to refresh from');
  }

  const scraped = await scrapeProductPage(url, { skipImages: true });
  const scrapeCache = buildScrapeCacheFromPageScrape(scraped, url, product.scrape_cache);

  const { data: updated, error: updateErr } = await supabase
    .from('products')
    .update({
      scrape_cache: scrapeCache,
      description: scraped.summary.slice(0, 4000),
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (updateErr || !updated) {
    throw new Error(updateErr?.message || 'Failed to update product');
  }

  return rowToProduct(updated as Record<string, unknown>);
}
