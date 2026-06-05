import type { ReferenceLogoAnalysis } from '@/lib/adaptation/types';
import {
  anchorMatchedDescriptions,
  catalogMatchDescription,
} from './product-fidelity';
import type {
  MatchedProductImage,
  ProductImage,
  ReferenceProductElement,
} from './types';

export function referenceNeedsStandaloneLogo(
  logoAnalysis: ReferenceLogoAnalysis | null | undefined
): boolean {
  if (!logoAnalysis) return false;
  return (
    logoAnalysis.standaloneLogoInLayout === true ||
    logoAnalysis.placement === 'standalone-logo' ||
    logoAnalysis.placement === 'standalone-and-product'
  );
}

export function injectLogoReferenceElement(
  elements: ReferenceProductElement[],
  logoAnalysis: ReferenceLogoAnalysis | null | undefined
): ReferenceProductElement[] {
  if (!referenceNeedsStandaloneLogo(logoAnalysis)) return elements;
  if (elements.some((e) => e.role === 'logo')) return elements;
  return [
    {
      role: 'logo',
      description:
        logoAnalysis?.notes?.trim() ||
        'Standalone brand wordmark centered at top of layout (above headline)',
    },
    ...elements,
  ];
}

function findDedicatedLogoIndex(productImages: ProductImage[]): number {
  return productImages.findIndex((img) => img.kind === 'logo');
}

export function ensureLogoCatalogMatches(
  matches: MatchedProductImage[],
  referenceElements: ReferenceProductElement[],
  productImages: ProductImage[]
): MatchedProductImage[] {
  const logoIdx = findDedicatedLogoIndex(productImages);
  if (logoIdx < 0) return matches;

  const logoImg = productImages[logoIdx];
  const out = [...matches];

  for (const el of referenceElements) {
    if (el.role !== 'logo') continue;
    const existingIdx = out.findIndex((m) => m.role === 'logo');
    const entry: MatchedProductImage = {
      role: 'logo',
      url: logoImg.url,
      catalogImageIndex: logoIdx,
      description: catalogMatchDescription('logo', logoImg, el.description),
    };
    if (existingIdx >= 0) out[existingIdx] = entry;
    else out.unshift(entry);
    return out;
  }

  return out;
}

/** When reference has standalone logo zone, attach dedicated logo upload even if identify/match missed it. */
export function ensureStandaloneLogoMatch(
  matches: MatchedProductImage[],
  productImages: ProductImage[],
  logoAnalysis: ReferenceLogoAnalysis | null | undefined,
  logoUrl?: string | null
): MatchedProductImage[] {
  if (!referenceNeedsStandaloneLogo(logoAnalysis)) return matches;
  if (matches.some((m) => m.role === 'logo')) return matches;

  let logoIdx = findDedicatedLogoIndex(productImages);
  if (logoIdx < 0 && logoUrl) {
    logoIdx = productImages.findIndex((i) => i.url === logoUrl);
  }
  if (logoIdx < 0) return matches;

  const logoImg = productImages[logoIdx];
  return [
    {
      role: 'logo',
      url: logoImg.url,
      catalogImageIndex: logoIdx,
      description: catalogMatchDescription(
        'logo',
        logoImg,
        logoAnalysis?.notes || 'Standalone brand logo at top of layout'
      ),
    },
    ...matches,
  ];
}

export function orderMatchedVisualsForGeneration(
  visuals: { role: string; url: string; description: string }[]
): { role: string; url: string; description: string }[] {
  const logos = visuals.filter((v) => v.role === 'logo');
  const rest = visuals.filter((v) => v.role !== 'logo');
  const seen = new Set<string>();
  const ordered: typeof visuals = [];
  for (const v of [...logos, ...rest]) {
    if (seen.has(v.url)) continue;
    seen.add(v.url);
    ordered.push(v);
  }
  return ordered;
}

export function reanchorLogoMatches(
  matches: MatchedProductImage[],
  productImages: ProductImage[],
  referenceElements: ReferenceProductElement[]
): MatchedProductImage[] {
  return anchorMatchedDescriptions(matches, productImages, referenceElements);
}
