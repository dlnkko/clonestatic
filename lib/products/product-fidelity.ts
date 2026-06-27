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

/** Short Kie suffix — main prompt carries ad-specific detail. */
export const KIE_RENDER_RULES_SUFFIX = `Rules: (1) The hero is the SAME EXACT PRODUCT as seen in the attached image(s) — reproduce its color, label, logo, container/format + shape 1:1; never invent, redesign, or swap the container (pouch stays a pouch, not a jar); only pose/angle/texture/render style follow the reference ad (hyperreal or stylized OK). (2) Copy verbatim, one row each. (3) Headline largest, subhead ~30%. (4) Hero = the same exact attached product only — never the competitor product category or its container shape. (5) No price unless reference had price badge.`;

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
  }
): string {
  if (!hasProductImages) return prompt.trim();

  const extras: string[] = [];

  if (options?.hasDedicatedLogo) {
    extras.push('Logo attached: use exact mark.');
  }

  if (options?.hasIllustrativeVisual && options.illustrationNotes?.trim()) {
    extras.push(`Reference style: ${options.illustrationNotes.trim().slice(0, 80)}.`);
  } else if (options?.hasPersonInReference) {
    extras.push('Candid smartphone photo; product on model correctly.');
    if (options?.productUseProfile && options.productUseProfile.confidence !== 'low') {
      extras.push(options.productUseProfile.placementInstruction.slice(0, 80));
    }
  }

  let out = `${prompt.trim()}\n\n${KIE_RENDER_RULES_SUFFIX}`;
  if (extras.length) out += ` ${extras.join(' ')}`;
  return out;
}
