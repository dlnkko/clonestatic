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
      return `User's brand logotype from catalog — render EXACTLY as printed on packaging in this photo, ${zone}. Do NOT invent a generic wordmark.`;
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
  return matches.map((m) => {
    const img = productImages.find((i) => i.url === m.url);
    const refEl = referenceElements.find((e) => e.role === m.role);
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
  const catalogLines =
    ctx.matchedProductVisuals.length > 0
      ? ctx.matchedProductVisuals
          .map((m) => `  - ${m.role}: ${m.description}`)
          .join('\n')
      : '  - Use ONLY the attached product image(s).';

  const productLabel = ctx.productName ? `"${ctx.productName}"` : "the user's product";

  return `**PRODUCT CATALOG FIDELITY (CRITICAL — non-negotiable):**
${productLabel} must appear ONLY as shown in the user's product catalog photos — NEVER as the reference ad's competitor product.

Catalog assets (sole source of product appearance):
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
- The FIRST image(s) in image_input are the user's REAL product from their store catalog. Render THAT product exactly — same packaging type, shape, labels, colors, and contents (e.g. gummy pouch/bag, not a pill bottle).
- Brand logo/wordmark on the product must match what is printed on the packaging in catalog photos — do NOT invent a separate footer or centered brand mark unless the prompt explicitly describes a standalone logo zone from the reference.
- The LAST image (if present) is the reference ad — use ONLY for layout, composition, and text placement. Do NOT copy its product shape OR its competitor-category environment (bedroom, kitchen, etc.) when the user's product belongs to a different category.
- Scene/setting/props must be 100% on-theme for the user's product (e.g. aesthetic gym for creatine) while keeping the reference's lighting mood and premium aesthetic.
- Never invent or substitute a different product form factor. If catalog shows gummies in a stand-up pouch, show the pouch — NOT a supplement bottle like the reference.`;

export function appendKieProductFidelityPrompt(prompt: string, hasProductImages: boolean): string {
  if (!hasProductImages) return prompt;
  return `${prompt.trim()}\n\n${KIE_PRODUCT_FIDELITY_SUFFIX}`;
}
