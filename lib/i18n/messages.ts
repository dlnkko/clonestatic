export type Locale = 'en' | 'es' | 'pt';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
};

type Messages = {
  nav: Record<string, string>;
  onboarding: Record<string, string>;
  library: Record<string, string>;
  products: Record<string, string>;
  common: Record<string, string>;
};

const en: Messages = {
  nav: {
    clone: 'Mirror',
    products: 'Products',
    adLibrary: 'Ad Library',
    history: 'History',
    support: 'Support',
    upgrade: 'Upgrade',
    signOut: 'Sign out',
    credits: 'credits',
  },
  onboarding: {
    title: 'Welcome to admirror',
    subtitle:
      'Upload your first product so we can match packaging, copy, and branding when you mirror winning static ads.',
    optional: 'Optional — you can skip and add a product later from the Products tab.',
    uploadProduct: 'Upload your first product',
    skip: 'Skip for now',
    later: 'You can always add products from the Products tab.',
  },
  library: {
    title: 'Static Ad Library',
    subtitle:
      'Curated US static ads from the Meta Ad Library. Same collection for every user, refreshed on a rolling schedule.',
    category: 'Category',
    chooseCategory: 'Choose category…',
    keywordOptional: 'Keyword (optional)',
    searchAds: 'Search ads',
    showBrands: 'Show brands',
    loading: 'Loading…',
    allAds: 'All ads in category',
    byBrand: 'By brand',
    filterBrands: 'Filter brands…',
    back: 'Back',
    brand: 'Brand',
    keyword: 'Keyword',
    adsCount: '{shown} of {total} ads',
    adsKeyword: 'Ads · keyword',
    adsBrand: 'Ads · brand',
    noAds: 'No ads match this filter yet.',
    loadMore: 'Load more',
    clone: 'Mirror',
    impressions: 'impressions',
    categoryLabel: 'Category',
  },
  products: {
    title: 'Products',
    subtitle: 'Save product URLs and images for faster cloning.',
    addProduct: 'Add product',
    empty: 'No products yet. Add one to reuse in Clone.',
    editTitle: 'Edit product',
    fromUrl: 'From URL',
    manual: 'Manual',
    imagesStored: '{count} images stored',
    name: 'Product name',
    description: 'Description',
    audience: 'Target audience',
    audiencePh: 'Optional',
    palette: 'Color palette',
    price: 'Price for ads (only this may appear)',
    pricePh: 'e.g. 120 USD — leave empty to hide all prices',
    priceHint: 'Never copied from reference ads. Empty = no price badge in generated ads.',
    productImages: 'Product images',
    save: 'Save changes',
    saving: 'Saving…',
    delete: 'Delete',
    detectedPrice: 'Detected from page',
  },
  common: {
    close: 'Close',
    open: 'Open',
    download: 'Download',
    required: 'REQUIRED',
    optional: 'OPTIONAL',
  },
};

// Requirement: all SaaS copy is English (even for ES/PT locale).
const es: Messages = en;

const pt: Messages = en;

export const messages: Record<Locale, Messages> = { en, es, pt };

export function t(
  locale: Locale,
  section: keyof Messages,
  key: string,
  vars?: Record<string, string | number>
): string {
  const table = messages[locale][section] as Record<string, string>;
  let text = table[key] ?? (messages.en[section] as Record<string, string>)[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
