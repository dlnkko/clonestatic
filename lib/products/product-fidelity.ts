import type { AdaptationContext } from '@/lib/adaptation/types';
import type { MatchedProductImage, ProductImage, ProductImageKind } from './types';

function truncateIllustrationNotes(text: string, max = 80): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

const LAYOUT_ZONE_RE =
  /\b(lower|upper|top|bottom|left|right|center|corner|beside|foreground|background|overlap|hero|side)[\w\s,-]*/i;

/** Extract layout position from reference element text without copying competitor container type. */
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

/** Catalog = brand truth; reference = layout zone only; pose is free at render time. */
export function catalogMatchDescription(
  role: MatchedProductImage['role'],
  img: ProductImage,
  referenceDescription?: string
): string {
  const zone = layoutHintFromReference(referenceDescription);
  const kindLabel = KIND_LABEL[img.kind ?? 'other'] ?? 'product photo';
  const brandRule =
    'Match packaging colors, logo, label text, and container shape from this photo; re-pose, re-angle, and re-scale freely; surface texture/material finish may follow the reference ad lighting and mood';

  switch (role) {
    case 'packaging':
      return `User's ${kindLabel} — ${brandRule}. Place in ${zone}. Use user's actual pouch/box/tube from catalog, not reference competitor shape.`;
    case 'trust_badge':
      return `User's trust/award badge — render exactly as in this photo at ${zone}.`;
    case 'logo':
      if (img.kind === 'logo') {
        return `User's brand logo — reproduce this exact logotype (mark, colors, proportions) in ${zone}.`;
      }
      return `User's brand logotype from packaging — ${brandRule} in ${zone}.`;
    case 'lifestyle':
      return `User's lifestyle photo — ${kindLabel}, ${zone}. ${brandRule}.`;
    case 'product':
    default:
      return `User's ${kindLabel} — ${brandRule} in ${zone}. Never substitute reference competitor product form.`;
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
      ? `Reference shows ${units.unitCount} unit(s)${units.distinctVariants ? ' with distinct variants' : ''} — use matched catalog photo per slot; re-pose each freely in layout.`
      : '';

  const productLabel = ctx.productName ? `"${ctx.productName}"` : "the user's product";

  return `**Product brand fidelity (catalog photos):**
${productLabel} appearance comes ONLY from catalog photos — colors, logo, label text, container type.
${variantRule}

Catalog:
${catalogLines}

Reference ad supplies **layout zones, composition, and surface texture/mood only** — not competitor product shape, not catalog photo pose.
At render time: match brand colors, label, logo, and container type exactly; freely re-angle, re-scale, re-light, and overlap units. **Texture/finish** (matte, gloss, soft folds, metallic sheen, condensation) may adapt to match the reference ad's product rendering style.`;
}

/** Kie suffix — short enforcer; main prompt carries ad-specific detail. */
export const KIE_RENDER_RULES_SUFFIX = `Rules: (1) Catalog = packaging color, label, logo, shape — exact; pose/texture free. (2) Copy verbatim, one row each. (3) Headline [XL], subhead [sm ~30%]. (4) No recolor, no invented badges, no merged lines.`;

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
    extras.push('Logo attached: use exact mark, not typed text.');
  }

  if (options?.hasIllustrativeVisual) {
    const notes = options.illustrationNotes?.trim()
      ? ` ${truncateIllustrationNotes(options.illustrationNotes)}`
      : '';
    extras.push(`Stylized/illustrated — not hyperreal photo.${notes}`);
  } else if (options?.hasPersonInReference) {
    extras.push('Candid smartphone photo; product on model correctly.');
    if (options?.productUseProfile && options.productUseProfile.confidence !== 'low') {
      extras.push(truncateIllustrationNotes(options.productUseProfile.placementInstruction));
    }
  }

  let out = `${prompt.trim()}\n\n${KIE_RENDER_RULES_SUFFIX}`;
  if (extras.length) {
    out += `\n${extras.join('\n')}`;
  }
  return out;
}
