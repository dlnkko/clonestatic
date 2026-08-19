/** Same-origin fallback when a product is saved without photos. */
export const PRODUCT_THUMB_PLACEHOLDER = '/product-thumb-placeholder.svg';

export function isDisplayableImageUrl(url: string | null | undefined): boolean {
  const v = url?.trim() ?? '';
  return v.startsWith('http') || v.startsWith('/');
}

/** Never empty — `products.primary_image_url` is NOT NULL. */
export function dbPrimaryImageUrl(
  images: { url: string; kind?: string }[],
  fallback?: string | null
): string {
  const fromCatalog =
    images.find((i) => i.kind !== 'logo' && isDisplayableImageUrl(i.url))?.url ??
    images.find((i) => isDisplayableImageUrl(i.url))?.url ??
    '';
  if (isDisplayableImageUrl(fromCatalog)) return fromCatalog.trim();
  if (isDisplayableImageUrl(fallback)) return fallback!.trim();
  return PRODUCT_THUMB_PLACEHOLDER;
}
