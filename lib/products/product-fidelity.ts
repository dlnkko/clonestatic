import type { AdaptationContext } from '@/lib/adaptation/types';
import type { MatchedProductImage, ProductImage, ProductImageKind } from './types';

const LAYOUT_ZONE_RE =
  /\b(lower|upper|top|bottom|left|right|center|corner|beside|foreground|background|overlap|hero|side)[\w\s,-]*/i;

export function layoutHintFromReference(referenceDescription?: string): string {
  if (!referenceDescription?.trim()) return 'the same layout zone as the reference ad';
  const match = referenceDescription.match(LAYOUT_ZONE_RE);
  if (match) return match[0].trim();
  return 'the same layout zone as the reference ad';
}

const KIND_LABEL: Record<ProductImageKind, string> = {
  product: 'product hero shot',
  packaging: 'retail packaging',
  logo: 'brand logo',
  trust_badge: 'trust badge',
  lifestyle: 'lifestyle shot',
  ingredient: 'ingredient graphic',
  other: 'product photo',
};

export function catalogMatchDescription(
  role: MatchedProductImage['role'],
  img: ProductImage,
  referenceDescription?: string
): string {
  const zone = layoutHintFromReference(referenceDescription);
  const kindLabel = KIND_LABEL[img.kind ?? 'other'] ?? 'product photo';
  const brandRule =
    'Match packaging colors, logo, label from photo; render style (hyperreal, stylized, matte, gloss) follows reference ad; re-pose freely';

  switch (role) {
    case 'packaging':
      return `User's ${kindLabel} — ${brandRule}. Place in ${zone}. User's pouch/box from catalog, not competitor shape.`;
    case 'trust_badge':
      return `User's trust badge — render exactly as in photo at ${zone}.`;
    case 'logo':
      if (img.kind === 'logo') {
        return `User's brand logo — exact logotype in ${zone}.`;
      }
      return `User's logotype from packaging — ${brandRule} in ${zone}.`;
    case 'lifestyle':
      return `User's lifestyle photo — ${kindLabel}, ${zone}.`;
    case 'product':
    default:
      return `User's ${kindLabel} — ${brandRule} in ${zone}.`;
  }
}

export function anchorMatchedDescriptions(
  matches: MatchedProductImage[],
  productImages: ProductImage[],
  referenceElements: { role: string; description: string }[]
): MatchedProductImage[] {
  return matches.map((m, index) => {
    const img = productImages.find((i) => i.url === m.url);
    const refEl = referenceElements[index] ?? referenceElements.find((e) => e.role === m.role);
    if (!img) return m;
    return {
      ...m,
      description: catalogMatchDescription(
        m.role,
        img,
        refEl?.description || m.description
      ),
    };
  });
}

export function productCatalogFidelityBlock(ctx: AdaptationContext): string {
  const units = ctx.referenceProductUnits;
  const catalogLines =
    ctx.matchedProductVisuals.length > 0
      ? ctx.matchedProductVisuals
          .map((m, i) => {
            const slot =
              m.role === 'product' || m.role === 'packaging'
                ? ` [unit ${i + 1}${units && units.unitCount > 1 ? ` of ${units.unitCount}` : ''}]`
                : '';
            return `  - ${m.role}${slot}: ${m.description}`;
          })
          .join('\n')
      : '  - Use attached product images only.';

  const variantRule =
    units && units.unitCount > 1
      ? `Reference shows ${units.unitCount} unit(s) — matched catalog photo per slot.`
      : '';

  const productLabel = ctx.productName ? `"${ctx.productName}"` : "the user's product";

  return `**Product catalog fidelity:**
The hero product MUST be **the same exact product as seen in the attached image(s)** — ${productLabel}. Reproduce it 1:1 from the attached photos: identical colors, label text, logo, container/format and shape. Do NOT redesign, restyle, relabel, or substitute it.
${variantRule}
${catalogLines}
Reference = layout zones only. Match the attached product exactly; only re-pose/re-light/re-angle it; product render style per reference ad.

**HERO PRODUCT (CRITICAL):** The ad is ALWAYS about **the same exact product as seen in the attached image(s)** (${productLabel}) — NEVER the reference competitor's product.
- Replace the reference product hero with the same exact product from the attached images (shape, label, packaging exactly as shown).
- **CONTAINER / FORMAT LOCK:** Reproduce the EXACT container/format shown in the attached photo (pouch stays a pouch, jar stays a jar, bottle stays a bottle, can stays a can). NEVER invent, swap, or "imagine" a different container, and NEVER borrow the reference's container shape. If the photo shows a stand-up pouch, the ad must show that same stand-up pouch — not a tub, jar, or bottle.
- FORBIDDEN: showing the competitor's product category (reference sells sheets → do NOT show bedding packages; reference sells pills → do NOT show competitor bottle shape unless catalog is pills).
- FORBIDDEN: reskinning the reference product — same container type as competitor with user's label only.
- Scene props from reference (rumpled sheets, bed, surfaces) may stay as background/styling when they support mood — but the sellable hero must be the user's product only (e.g. sleep drink can on bedsheets, NOT a sheets package).`;
}

/**
 * Leading directive — placed FIRST in the prompt because image models weight the
 * opening instruction most. Only the product image(s) are attached at generation
 * time (NOT the reference ad), so this must be self-contained, not reference-relative.
 */
export const KIE_PRODUCT_FIRST_DIRECTIVE =
  'Use the SAME EXACT PRODUCT from the attached image(s) — reproduce its exact container/format (pouch, box, bottle, jar, or loose units), label, logo, and colors. NEVER reshape into the reference ad competitor container (e.g. never turn a pouch into a cylinder/bottle). Only pose, angle, and lighting may change.';

function buildKieColorRule(productBrandColors?: string[]): string {
  const colors = (productBrandColors ?? [])
    .map((c) => (typeof c === 'string' ? c.trim() : ''))
    .filter(Boolean)
    .slice(0, 5);
  if (colors.length > 0) {
    return `Adapt the ad's background and accent colors to the product's OWN brand palette (${colors.join(', ')}) — keep the layout's color roles and contrast, but recolor with these hues; do NOT keep the reference ad's competitor colors.`;
  }
  return `Adapt the ad's background and accent colors to the attached product's OWN colors (packaging, label, dominant hues) — keep the layout's color roles and contrast, but recolor to match the product; do NOT keep the reference ad's competitor colors.`;
}

function buildKiePriceRule(referenceHasPriceVisual?: boolean, allowedPrice?: string | null): string {
  // Resolved at build time — the image model never sees the reference ad, so the rule
  // must be definitive, never "unless the reference had a price".
  if (referenceHasPriceVisual) {
    const price = allowedPrice?.trim();
    return price
      ? `Show the price exactly as "${price}" — no other amount, no invented prices.`
      : 'Only show a price badge if a verified product price is provided; otherwise omit any price.';
  }
  return 'Do NOT include any price, dollar amount, "$XX", price sticker, or price badge anywhere in the ad.';
}

export function appendKieProductFidelityPrompt(
  prompt: string,
  hasProductImages: boolean,
  options?: {
    hasDedicatedLogo?: boolean;
    productUseProfile?: import('@/lib/products/infer-product-use').ProductUseProfile | null;
    hasPersonInReference?: boolean;
    hasIllustrativeVisual?: boolean;
    visualMedium?: string;
    illustrationNotes?: string;
    referenceHasPriceVisual?: boolean;
    allowedPrice?: string | null;
    productBrandColors?: string[];
    hasPhotoGraphicOverlay?: boolean;
  }
): string {
  if (!hasProductImages) return prompt.trim();

  const extras: string[] = [];

  if (options?.hasDedicatedLogo) {
    extras.push('Logo attached: use exact mark.');
  }

  if (options?.hasIllustrativeVisual && options.illustrationNotes?.trim()) {
    extras.push(`Render style: ${options.illustrationNotes.trim().slice(0, 80)}.`);
  } else if (options?.hasPersonInReference) {
    extras.push('Candid smartphone photo; product on model correctly.');
    if (options?.productUseProfile && options.productUseProfile.confidence !== 'low') {
      extras.push(options.productUseProfile.placementInstruction.slice(0, 80));
    }
  }

  const colorRule = buildKieColorRule(options?.productBrandColors);
  const priceRule = buildKiePriceRule(options?.referenceHasPriceVisual, options?.allowedPrice);

  // Prevent the product photo's incidental background (hands, backpack, surface) from
  // leaking, and stop the model leaving blurred/empty/vignetted dead zones (often the
  // bottom of the frame) when the described background does not fill a tall ratio.
  // For realistic photo ads, intentional depth-of-field is allowed; for design/graphic
  // ads the background must stay sharp and uniform edge-to-edge.
  const isRealisticScene = options?.hasPersonInReference || options?.hasIllustrativeVisual;
  const photoOrMixed =
    options?.visualMedium === 'photo' || options?.visualMedium === 'mixed';
  const needsPhotoOverlayLock =
    photoOrMixed && (options?.hasPersonInReference || options?.hasPhotoGraphicOverlay);
  const backgroundIntegrityRule = isRealisticScene
    ? 'Use ONLY the product from the attached image(s); do not reproduce its original photo background, hand, or surroundings. The composition must fill the ENTIRE frame to every edge — no empty, blank, smudged, or unfinished dead zones (especially the bottom and corners). Any blur must be intentional, even depth-of-field, never a leftover smear of the product photo background.'
    : 'Extract ONLY the product from the attached image(s); ignore and never reproduce its original photo background, hand, or surroundings. Render the described background sharply and uniformly across the ENTIRE frame, all the way to every edge — no blurred, faded, vignetted, smudged, empty, or out-of-focus areas anywhere (especially the bottom and corners).';

  // Self-contained rules — no "follow the reference ad" (the reference is not attached here).
  const rules = `Rules: (1) Hero = SAME EXACT PRODUCT from attached image(s): container/format + label + logo + colors reproduced 1:1 — a pouch stays a pouch, never a bottle/cylinder/jar; only pose/angle/lighting may change. (2) Copy verbatim, one row each. (3) Headline largest, subhead ~30%. (4) ${colorRule} (5) ${priceRule} (6) ${backgroundIntegrityRule}${needsPhotoOverlayLock ? ' (7) ONE integrated ad: full-bleed photo + overlays ON TOP — never split bands.' : ''}`;

  let out = `${KIE_PRODUCT_FIRST_DIRECTIVE}\n\n${prompt.trim()}\n\n${rules}`;
  if (extras.length) out += ` ${extras.join(' ')}`;
  return out;
}
