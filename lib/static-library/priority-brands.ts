import { SKINCARE_TOP_BRANDS } from './seeds-skincare-top';

/** Known brands shown first when browsing a category (before impression sort). */
export const PRIORITY_BRANDS_BY_CATEGORY: Record<string, readonly string[]> = {
  beauty: [
    ...SKINCARE_TOP_BRANDS,
    'Glossier',
    'Drunk Elephant',
    'Tatcha',
    'Summer Fridays',
    'Rare Beauty',
    'Saie',
    'Kosas',
    'Charlotte Tilbury',
    'Tower 28',
    'The Ordinary',
    "Paula's Choice",
    'Fenty Beauty',
    'e.l.f. Cosmetics',
    'Olaplex',
    'Glow Recipe',
    'Merit',
    'ILIA Beauty',
    'Huda Beauty',
    'Kylie Cosmetics',
    'ColourPop',
  ],
};

export function sortBrandsByPriority<
  T extends { brandName: string; maxImpressions?: number | null },
>(
  category: string,
  brands: T[]
): T[] {
  const priority = PRIORITY_BRANDS_BY_CATEGORY[category];
  if (!priority?.length) return brands;

  const rank = new Map<string, number>();
  priority.forEach((name, i) => {
    rank.set(name.toLowerCase(), i);
  });

  return [...brands].sort((a, b) => {
    const ra = rank.get(a.brandName.toLowerCase());
    const rb = rank.get(b.brandName.toLowerCase());
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    const ai = a.maxImpressions ?? 0;
    const bi = b.maxImpressions ?? 0;
    if (bi !== ai) return bi - ai;
    return a.brandName.localeCompare(b.brandName);
  });
}
