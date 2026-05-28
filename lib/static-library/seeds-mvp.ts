import { buildBrandSeeds } from './seeds-brands';
import type { StaticAdSeed } from './types';

/** Generic product keywords — 1 page each in brand_bootstrap, runs last. */
const GENERIC_KEYWORD_SEEDS: StaticAdSeed[] = [
  // sleep
  { seed_type: 'keyword', value: 'pillow', category: 'sleep' },
  { seed_type: 'keyword', value: 'mattress', category: 'sleep' },
  { seed_type: 'keyword', value: 'sleep mask', category: 'sleep' },
  { seed_type: 'keyword', value: 'weighted blanket', category: 'sleep' },
  { seed_type: 'keyword', value: 'silk pillowcase', category: 'sleep' },
  { seed_type: 'keyword', value: 'mouth tape', category: 'sleep' },
  { seed_type: 'keyword', value: 'melatonin', category: 'sleep' },
  { seed_type: 'keyword', value: 'white noise', category: 'sleep' },
  { seed_type: 'keyword', value: 'cooling pillow', category: 'sleep' },
  { seed_type: 'keyword', value: 'bed sheets', category: 'sleep' },
  { seed_type: 'keyword', value: 'linen sheets', category: 'sleep' },
  { seed_type: 'keyword', value: 'duvet cover', category: 'sleep' },
  { seed_type: 'keyword', value: 'comforter', category: 'sleep' },
  { seed_type: 'keyword', value: 'mattress topper', category: 'sleep' },
  { seed_type: 'keyword', value: 'blackout curtains', category: 'sleep' },
  { seed_type: 'keyword', value: 'sleep supplement', category: 'sleep' },
  { seed_type: 'keyword', value: 'body pillow', category: 'sleep' },
  { seed_type: 'keyword', value: 'adjustable bed', category: 'sleep' },
  // beauty
  { seed_type: 'keyword', value: 'serum', category: 'beauty' },
  { seed_type: 'keyword', value: 'moisturizer', category: 'beauty' },
  { seed_type: 'keyword', value: 'retinol', category: 'beauty' },
  { seed_type: 'keyword', value: 'vitamin c', category: 'beauty' },
  { seed_type: 'keyword', value: 'sunscreen', category: 'beauty' },
  { seed_type: 'keyword', value: 'cleanser', category: 'beauty' },
  { seed_type: 'keyword', value: 'toner', category: 'beauty' },
  { seed_type: 'keyword', value: 'eye cream', category: 'beauty' },
  { seed_type: 'keyword', value: 'lip balm', category: 'beauty' },
  { seed_type: 'keyword', value: 'face mask', category: 'beauty' },
  { seed_type: 'keyword', value: 'niacinamide', category: 'beauty' },
  { seed_type: 'keyword', value: 'hyaluronic acid', category: 'beauty' },
  { seed_type: 'keyword', value: 'skincare', category: 'beauty' },
  { seed_type: 'keyword', value: 'acne patches', category: 'beauty' },
  { seed_type: 'keyword', value: 'lip oil', category: 'beauty' },
  { seed_type: 'keyword', value: 'foundation', category: 'beauty' },
  { seed_type: 'keyword', value: 'mascara', category: 'beauty' },
  { seed_type: 'keyword', value: 'blush', category: 'beauty' },
  // supplements
  { seed_type: 'keyword', value: 'collagen', category: 'supplements' },
  { seed_type: 'keyword', value: 'protein powder', category: 'supplements' },
  { seed_type: 'keyword', value: 'greens powder', category: 'supplements' },
  { seed_type: 'keyword', value: 'multivitamin', category: 'supplements' },
  { seed_type: 'keyword', value: 'creatine', category: 'supplements' },
  { seed_type: 'keyword', value: 'creatine gummies', category: 'supplements' },
  { seed_type: 'keyword', value: 'protein gummies', category: 'supplements' },
  { seed_type: 'keyword', value: 'probiotics', category: 'supplements' },
  { seed_type: 'keyword', value: 'omega 3', category: 'supplements' },
  { seed_type: 'keyword', value: 'electrolytes', category: 'supplements' },
  { seed_type: 'keyword', value: 'magnesium', category: 'supplements' },
  { seed_type: 'keyword', value: 'ashwagandha', category: 'supplements' },
  { seed_type: 'keyword', value: 'vitamin d', category: 'supplements' },
  { seed_type: 'keyword', value: 'zinc supplement', category: 'supplements' },
  { seed_type: 'keyword', value: 'collagen peptides', category: 'supplements' },
  { seed_type: 'keyword', value: 'prebiotic', category: 'supplements' },
  { seed_type: 'keyword', value: 'fiber supplement', category: 'supplements' },
  { seed_type: 'keyword', value: 'sleep gummies', category: 'supplements' },
  // fitness
  { seed_type: 'keyword', value: 'yoga mat', category: 'fitness' },
  { seed_type: 'keyword', value: 'resistance bands', category: 'fitness' },
  { seed_type: 'keyword', value: 'running shoes', category: 'fitness' },
  { seed_type: 'keyword', value: 'gym bag', category: 'fitness' },
  { seed_type: 'keyword', value: 'protein bar', category: 'fitness' },
  { seed_type: 'keyword', value: 'pre workout', category: 'fitness' },
  { seed_type: 'keyword', value: 'fitness tracker', category: 'fitness' },
  { seed_type: 'keyword', value: 'foam roller', category: 'fitness' },
  { seed_type: 'keyword', value: 'dumbbells', category: 'fitness' },
  { seed_type: 'keyword', value: 'kettlebell', category: 'fitness' },
  { seed_type: 'keyword', value: 'sports bra', category: 'fitness' },
  { seed_type: 'keyword', value: 'workout shorts', category: 'fitness' },
  { seed_type: 'keyword', value: 'lifting belt', category: 'fitness' },
  // home
  { seed_type: 'keyword', value: 'air purifier', category: 'home' },
  { seed_type: 'keyword', value: 'tower fan', category: 'home' },
  { seed_type: 'keyword', value: 'desk fan', category: 'home' },
  { seed_type: 'keyword', value: 'humidifier', category: 'home' },
  { seed_type: 'keyword', value: 'dehumidifier', category: 'home' },
  { seed_type: 'keyword', value: 'candle', category: 'home' },
  { seed_type: 'keyword', value: 'diffuser', category: 'home' },
  { seed_type: 'keyword', value: 'throw blanket', category: 'home' },
  { seed_type: 'keyword', value: 'organizer', category: 'home' },
  { seed_type: 'keyword', value: 'cleaning spray', category: 'home' },
  { seed_type: 'keyword', value: 'vacuum', category: 'home' },
  { seed_type: 'keyword', value: 'cookware', category: 'home' },
  { seed_type: 'keyword', value: 'knife set', category: 'home' },
  { seed_type: 'keyword', value: 'storage bins', category: 'home' },
  // pet
  { seed_type: 'keyword', value: 'dog food', category: 'pet' },
  { seed_type: 'keyword', value: 'cat litter', category: 'pet' },
  { seed_type: 'keyword', value: 'pet treats', category: 'pet' },
  { seed_type: 'keyword', value: 'dog bed', category: 'pet' },
  { seed_type: 'keyword', value: 'pet supplement', category: 'pet' },
  { seed_type: 'keyword', value: 'dog shampoo', category: 'pet' },
  { seed_type: 'keyword', value: 'cat food', category: 'pet' },
  { seed_type: 'keyword', value: 'pet collar', category: 'pet' },
  // food
  { seed_type: 'keyword', value: 'coffee', category: 'food' },
  { seed_type: 'keyword', value: 'matcha', category: 'food' },
  { seed_type: 'keyword', value: 'protein shake', category: 'food' },
  { seed_type: 'keyword', value: 'snack bar', category: 'food' },
  { seed_type: 'keyword', value: 'hot sauce', category: 'food' },
  { seed_type: 'keyword', value: 'energy drink', category: 'food' },
  { seed_type: 'keyword', value: 'sparkling water', category: 'food' },
  { seed_type: 'keyword', value: 'meal replacement', category: 'food' },
  { seed_type: 'keyword', value: 'granola', category: 'food' },
  { seed_type: 'keyword', value: 'olive oil', category: 'food' },
  // apparel
  { seed_type: 'keyword', value: 'leggings', category: 'apparel' },
  { seed_type: 'keyword', value: 'sneakers', category: 'apparel' },
  { seed_type: 'keyword', value: 'hoodie', category: 'apparel' },
  { seed_type: 'keyword', value: 'socks', category: 'apparel' },
  { seed_type: 'keyword', value: 't shirt', category: 'apparel' },
  { seed_type: 'keyword', value: 'joggers', category: 'apparel' },
  { seed_type: 'keyword', value: 'base layer', category: 'apparel' },
  { seed_type: 'keyword', value: 'winter jacket', category: 'apparel' },
  // wellness
  { seed_type: 'keyword', value: 'deodorant', category: 'wellness' },
  { seed_type: 'keyword', value: 'toothpaste', category: 'wellness' },
  { seed_type: 'keyword', value: 'razor', category: 'wellness' },
  { seed_type: 'keyword', value: 'hair serum', category: 'wellness' },
  { seed_type: 'keyword', value: 'shampoo bar', category: 'wellness' },
  { seed_type: 'keyword', value: 'period underwear', category: 'wellness' },
  { seed_type: 'keyword', value: 'mouthwash', category: 'wellness' },
  { seed_type: 'keyword', value: 'whitening strips', category: 'wellness' },
  { seed_type: 'keyword', value: 'dry shampoo', category: 'wellness' },
  { seed_type: 'keyword', value: 'body wash', category: 'wellness' },
  { seed_type: 'keyword', value: 'hand cream', category: 'wellness' },
  // tech
  { seed_type: 'keyword', value: 'phone case', category: 'tech' },
  { seed_type: 'keyword', value: 'blue light glasses', category: 'tech' },
  { seed_type: 'keyword', value: 'wireless charger', category: 'tech' },
  { seed_type: 'keyword', value: 'laptop stand', category: 'tech' },
  { seed_type: 'keyword', value: 'webcam', category: 'tech' },
  { seed_type: 'keyword', value: 'mechanical keyboard', category: 'tech' },
  { seed_type: 'keyword', value: 'power bank', category: 'tech' },
  { seed_type: 'keyword', value: 'earplugs', category: 'tech' },
];

/** Companies first, then brand keywords, then generic product keywords. */
export const MVP_SEEDS: StaticAdSeed[] = (() => {
  const brandSeeds = buildBrandSeeds();
  const companies = brandSeeds.filter((s) => s.seed_type === 'company');
  const brandKeywords = brandSeeds.filter((s) => s.brand_keyword);
  const generic = GENERIC_KEYWORD_SEEDS.map((s) => ({ ...s, brand_keyword: false }));
  const all = [...companies, ...brandKeywords, ...generic];
  all.forEach((s, i) => {
    s.sort_order = i + 1;
  });
  return all;
})();

export const LIBRARY_CATEGORIES = [
  'sleep',
  'beauty',
  'supplements',
  'fitness',
  'home',
  'pet',
  'food',
  'apparel',
  'wellness',
  'tech',
] as const;

export function countSeedsByType(): {
  keywords: number;
  companies: number;
  brandKeywords: number;
  genericKeywords: number;
  total: number;
} {
  const companies = MVP_SEEDS.filter((s) => s.seed_type === 'company').length;
  const brandKeywords = MVP_SEEDS.filter((s) => s.brand_keyword).length;
  const genericKeywords = MVP_SEEDS.filter(
    (s) => s.seed_type === 'keyword' && !s.brand_keyword
  ).length;
  return {
    keywords: brandKeywords + genericKeywords,
    companies,
    brandKeywords,
    genericKeywords,
    total: MVP_SEEDS.length,
  };
}

/** Lookup brand_keyword flag for ingest ordering / page limits. */
export function seedMetaByKey(): Map<string, StaticAdSeed> {
  const map = new Map<string, StaticAdSeed>();
  for (const s of MVP_SEEDS) {
    map.set(`${s.seed_type}:${s.value.trim().toLowerCase()}`, s);
  }
  return map;
}

export function orderedSeedsForIngest(): StaticAdSeed[] {
  return [...MVP_SEEDS].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}
