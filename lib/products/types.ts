export type ProductImageKind =
  | 'product'
  | 'packaging'
  | 'logo'
  | 'trust_badge'
  | 'lifestyle'
  | 'ingredient'
  | 'other';

export type ProductImage = {
  url: string;
  kind?: ProductImageKind;
  alt?: string;
};

export type PricingTier = {
  id: string;
  label: string;
  unitPrice: string;
  discountPercent?: number | null;
  badge?: string | null;
  isDefault?: boolean;
};

export type ExtractedPricing = {
  regularPrice: string | null;
  salePrice: string | null;
  currency: string;
  rawSnippets: string[];
  /** Quantity / bundle tiers scraped from the page */
  tiers?: PricingTier[];
  compareAtPrice?: string | null;
};

export type ProductPricingConfig = {
  mode: 'single' | 'tiers';
  currency: string;
  /** Primary price shown in ads (single mode or default tier) */
  priceDisplay: string | null;
  compareAtPrice?: string | null;
  tiers?: PricingTier[];
};

export type ProductScrapeCache = {
  summary: string;
  branding: Record<string, unknown> | null;
  markdown: string | null;
  scrapedAt: string;
  productUrl?: string;
  extractedPricing?: ExtractedPricing;
  /** User-edited price to show in ads; overrides extracted */
  priceDisplay?: string | null;
  /** Bundles, tiers, discounts — user-editable */
  pricingConfig?: ProductPricingConfig;
};

export type ProductRecord = {
  id: string;
  user_id: string;
  name: string;
  source: 'url' | 'manual';
  product_url: string | null;
  description: string | null;
  target_audience: string | null;
  color_palette: { colors?: string[]; notes?: string } | null;
  logo_url: string | null;
  primary_image_url: string;
  images: ProductImage[];
  scrape_cache: ProductScrapeCache | null;
  created_at: string;
  updated_at: string;
};

export type ReferenceProductElement = {
  role: ProductImageKind;
  description: string;
};

export type MatchedProductImage = {
  role: ProductImageKind;
  url: string;
  description: string;
};
