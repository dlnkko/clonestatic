/**
 * Top US skincare brands (Meta Ad Library targets).
 * Resolved via scripts/resolve-skincare-brands.ts (Gemini + Google Search).
 */
export const SKINCARE_TOP_BRANDS = [
  'CeraVe',
  'La Roche-Posay',
  'Neutrogena',
  'Cetaphil',
  'Olay',
  'Clinique',
  "Kiehl's",
  'Estée Lauder',
  "L'Oréal Paris",
  'Aveeno',
  'Bioderma',
  'SkinCeuticals',
  'First Aid Beauty',
  'ROC Skincare',
  'Eucerin',
] as const;

export type SkincareTopBrand = (typeof SKINCARE_TOP_BRANDS)[number];
