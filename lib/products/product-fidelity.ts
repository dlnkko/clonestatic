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

/** Description for image gen — catalog photo is source of truth, reference only supplies layout zone. */
export function catalogMatchDescription(
  role: MatchedProductImage['role'],
  img: ProductImage,
  referenceDescription?: string
): string {
  const zone = layoutHintFromReference(referenceDescription);
  const kindLabel = KIND_LABEL[img.kind ?? 'other'] ?? 'product photo';

  switch (role) {
    case 'packaging':
      return `User's ${kindLabel} from catalog — render EXACTLY as in this attached photo (same pouch/bag/box/tube shape and label). Place in ${zone}. NEVER copy the reference competitor's bottle/jar/tub shape.`;
    case 'trust_badge':
      return `User's trust/award badge from catalog — render EXACTLY as in this photo, overlapping product at ${zone}.`;
    case 'logo':
      if (img.kind === 'logo') {
        return `User's DEDICATED brand logo file — reproduce this exact logotype graphic (letterforms, colors, proportions) in ${zone}. Do NOT redraw as plain text or substitute a generic font.`;
      }
      return `User's brand logotype — render EXACTLY as printed on packaging in this photo, ${zone}. Do NOT invent a generic wordmark.`;
    case 'lifestyle':
      return `User's lifestyle photo from catalog — ${kindLabel}, ${zone}.`;
    case 'product':
    default:
      return `User's ${kindLabel} from catalog — render EXACTLY as in this attached photo (same product form: gummies, pouch contents, units, etc.). Compose in ${zone}. NEVER substitute reference competitor product shape.`;
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
                ? ` [visible unit ${i + 1}${units && units.unitCount > 1 ? ` of ${units.unitCount}` : ''}]`
                : '';
            return `  - ${m.role}${slot}: ${m.description}`;
          })
          .join('\n')
      : '  - Use ONLY the attached product image(s).';

  const variantRule =
    units && units.unitCount > 1
      ? `\n**MULTI-UNIT LAYOUT:** Reference shows **${units.unitCount}** visible product unit(s)${units.distinctVariants ? ' with **distinct variants** (different flavors/colors/packaging)' : ' (same SKU repeated)'}. Use the matched catalog photo per slot — ${units.distinctVariants ? 'each slot should show a DIFFERENT catalog variant when available; never render three copies of one flavor when reference had three different ones' : 'repeat the same catalog photo for each unit when reference shows identical units'}. If user uploaded only 1 product photo, show 1 unit (do not invent extra variants).`
      : '';

  const productLabel = ctx.productName ? `"${ctx.productName}"` : "the user's product";

  const dedicatedLogo = ctx.matchedProductVisuals.find((m) => m.role === 'logo');
  const logoRule = dedicatedLogo
    ? `\n**STANDALONE LOGO:** Reference has a standalone logo zone — reproduce the **dedicated logo catalog image** exactly (${dedicatedLogo.description}). Do NOT substitute plain text.`
    : '';

  return `**PRODUCT CATALOG FIDELITY (CRITICAL — non-negotiable):**
${productLabel} must appear ONLY as shown in the user's product catalog photos — NEVER as the reference ad's competitor product.
${variantRule}${logoRule}

Catalog assets (sole source of product appearance — one row per visible unit/slot):
${catalogLines}

**The reference ad is for LAYOUT + COPY structure only** — composition, text placement, lighting mood, and where heroes sit in the frame. **Environment/props must match the user's product category** (not the competitor's setting).

**FORBIDDEN (never do this):**
- Rendering the reference competitor's product (wrong brand, wrong bottle, wrong capsules/pills)
- "Reskinning" the reference product: same bottle/jar shape with user's brand swapped in
- Inventing packaging or product form not visible in catalog photos (e.g. supplement bottle when catalog shows gummy pouch)
- Generic stock packaging when catalog has specific photos

**REQUIRED:**
- Container type, labels, colors, logo, and product form (gummies vs capsules vs powder vs pouch) must match the catalog photos exactly
- Mirror reference **position/zones** only — user's actual packaging/product photos fill those zones`;
}

export const KIE_PRODUCT_FIDELITY_SUFFIX = `CRITICAL — PRODUCT FIDELITY (non-negotiable):
- Every attached catalog image is the user's REAL product (packaging, units, lifestyle, trust badge, and/or dedicated logo file). Render those assets exactly — same packaging type, shape, labels, colors, and contents.
- When a dedicated logo image is attached, reproduce that exact logotype in the standalone logo zone from the prompt — not plain typed text.
- Layout, composition, text placement, and lighting mood come from the written prompt (derived from reference analysis). Do NOT copy competitor product shapes or off-category environments.
- Scene/setting/props must be on-theme for the user's product while matching the prompt's mood and aesthetic.
- Never invent or substitute a different product form factor than shown in the catalog photos.`;

export const KIE_DEDICATED_LOGO_SUFFIX = `CRITICAL — STANDALONE BRAND LOGO:
- When a dedicated logo image is included in image_input, reproduce that EXACT logo graphic in the standalone logo zone described in the prompt (same letterforms, colors, stroke weight, and proportions).
- Do NOT replace the logo with plain typed text, a generic sans-serif wordmark, or a re-drawn approximation.
- The standalone logo is separate from text headlines — render it as the actual brand mark from the provided logo file.`;

export function appendKieProductFidelityPrompt(
  prompt: string,
  hasProductImages: boolean,
  options?: { hasDedicatedLogo?: boolean; productUseProfile?: import('@/lib/products/infer-product-use').ProductUseProfile | null; hasPersonInReference?: boolean }
): string {
  if (!hasProductImages) return prompt;
  let out = `${prompt.trim()}\n\n${KIE_PRODUCT_FIDELITY_SUFFIX}`;
  if (options?.hasDedicatedLogo) {
    out += `\n\n${KIE_DEDICATED_LOGO_SUFFIX}`;
  }
  if (options?.hasPersonInReference && options?.productUseProfile && options.productUseProfile.confidence !== 'low') {
    const p = options.productUseProfile;
    out += `\n\nMODEL + PRODUCT PLACEMENT (CRITICAL): Show ${p.category} with authentic use on model — ${p.placementInstruction} Forbidden: ${p.forbiddenPlacements.slice(0, 3).join('; ')}.`;
  } else if (options?.hasPersonInReference) {
    out += `\n\nMODEL + PRODUCT PLACEMENT (CRITICAL): Product must be worn/applied/held/consumed correctly on the model — correct anatomical zone, not floating decoratively on wrong body part.`;
  }
  return out;
}
