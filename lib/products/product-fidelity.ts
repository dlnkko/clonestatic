import type { AdaptationContext } from '@/lib/adaptation/types';
import type { MatchedProductImage, ProductImage, ProductImageKind } from './types';

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

/** Single Kie suffix — one priority stack, no redundant CRITICAL blocks. */
export const KIE_RENDER_RULES_SUFFIX = `Render rules (in order):
1. Product brand: attached catalog images are the ONLY source for packaging color, label layout, logo, and container shape — reproduce exactly. You may change pose, angle, position, scale, overlap, lighting, and surface texture/finish to match the reference ad's product mood; do not paste the catalog photo pose unchanged.
2. Copy: render each quoted line on its own visual row exactly as given — do not merge lines, rewrite, translate, or invent text (no fake badges, awards, or flavor claims).
3. Typography: headline must be clearly largest; subheadline ~28–38% of headline cap height, light/regular weight — never equal size to headline.
4. Layout: follow composition in the prompt; reference supplies zones and texture mood — not competitor product form or colors.

FORBIDDEN: recoloring the product (e.g. navy can → light blue), redesigning labels, inventing trust badges, merging headline+subheadline into one line, subheadline as bold/large as headline.`;

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
    extras.push(
      'Logo file attached: reproduce that exact mark in the logo zone — not plain typed text.'
    );
  }

  if (options?.hasIllustrativeVisual) {
    const medium = options.visualMedium ? ` Medium: ${options.visualMedium}.` : '';
    const notes = options.illustrationNotes?.trim()
      ? ` Style: ${options.illustrationNotes.trim()}.`
      : '';
    extras.push(
      `Keep illustrated/diagram elements stylized like the reference — do not convert to hyperreal gym photography.${medium}${notes}`
    );
  } else if (options?.hasPersonInReference) {
    extras.push(
      'Real photo people: candid smartphone feel; product worn/applied/held correctly on model.'
    );
    if (options?.productUseProfile && options.productUseProfile.confidence !== 'low') {
      const p = options.productUseProfile;
      extras.push(`Placement: ${p.placementInstruction}`);
    }
  }

  let out = `${prompt.trim()}\n\n${KIE_RENDER_RULES_SUFFIX}`;
  if (extras.length) {
    out += `\n${extras.join('\n')}`;
  }
  return out;
}
