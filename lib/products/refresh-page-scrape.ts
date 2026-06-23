import type { SupabaseClient } from '@supabase/supabase-js';
import { rowToProduct } from '@/lib/products/db';
import { buildScrapeCacheFromPageScrape } from '@/lib/products/build-scrape-cache';
import { scrapeCacheContentChanged } from '@/lib/products/compare-scrape-cache';
import { scrapeProductPage } from '@/lib/products/scrape';
import type { ProductRecord } from '@/lib/products/types';

export type RefreshProductPageResult = {
  product: ProductRecord;
  updated: boolean;
};

/** Re-scrape product page text and update scrape_cache only when live page data changed. */
export async function refreshProductPageScrape(
  supabase: SupabaseClient,
  productId: string,
  userId: string
): Promise<RefreshProductPageResult> {
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
  const changed = scrapeCacheContentChanged(product.scrape_cache, scraped);

  if (!changed) {
    return { product, updated: false };
  }

  const scrapeCache = buildScrapeCacheFromPageScrape(scraped, url, product.scrape_cache);

  const { data: updated, error: updateErr } = await supabase
    .from('products')
    .update({
      scrape_cache: scrapeCache,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (updateErr || !updated) {
    throw new Error(updateErr?.message || 'Failed to update product');
  }

  return { product: rowToProduct(updated as Record<string, unknown>), updated: true };
}
