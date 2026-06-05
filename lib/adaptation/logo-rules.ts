import type { AdaptationContext } from './types';

/** Logo/wordmark sourced from packaging photos — applies even without a dedicated logo upload. */
export function packagingLogoRulesBlock(ctx: AdaptationContext): string {
  const hasDedicatedLogo = ctx.matchedProductVisuals.some((m) => m.role === 'logo');
  const productLabel = ctx.productName ?? "the user's product";

  return `**LOGO FROM PRODUCT PACKAGING (CRITICAL — every ad):**
Brand identity often lives **on the product packaging** in catalog photos. A separate logo upload is NOT required.

**REQUIRED:**
- Render the brand logotype/wordmark **exactly as printed on the user's packaging** in catalog photos (pouch, box, tub, label)
- Typography, colors, and logo placement on the pack must match the attached product images — not a generic re-draw of the brand name
${hasDedicatedLogo ? '- A dedicated logo catalog image is also attached — use it when the reference had a standalone logo zone in the layout.' : '- No separate logo image was uploaded — derive the brand mark ONLY from packaging photos. Do NOT invent a new wordmark from scraped website assets or guess a font.'}

**Standalone logo in layout (only when reference had one):**
- If the reference includes a separate brand mark (footer, center, corner), recreate the user's brand using the **logotype visible on their packaging** in that position
- Match the packaging's logo style — do NOT use a random sans-serif brand name if the pack shows a specific wordmark

**When reference is copy-only or logo-on-product-only:**
- Do NOT add a separate footer wordmark, centered emblem, or large standalone "brand name" text that the reference did not have
- Brand identity = headline copy + logo/labels **printed on the product in the shot**

**FORBIDDEN:**
- Inventing a logo that does not match packaging typography (e.g. generic "BLOOM" footer when reference had no footer brand and logo only exists on the pouch)
- Pulling scraped website favicon/logo URLs into the layout as graphic elements when reference did not have a standalone logo
- Adding competitor-style brand placement that misrepresents how the user's brand appears on their actual packaging`;
}

/** Shared instructions so agents do not invent a centered/wordmark logo when reference is copy-only. */
export function logoPlacementRulesBlock(ctx: AdaptationContext): string {
  const { placement, standaloneLogoInLayout, logoOnProductOnly, notes } =
    ctx.referenceLogoAnalysis;

  let placementRule: string;

  if (
    placement === 'copy-only' ||
    placement === 'logo-on-product-only' ||
    (!standaloneLogoInLayout && placement !== 'standalone-logo' && placement !== 'standalone-and-product')
  ) {
    placementRule = `**LOGO PLACEMENT (CRITICAL):**
Reference brand presentation = ${placement === 'copy-only' ? 'COPY/TEXT ONLY at top — no separate logo mark in the layout' : 'logo ONLY on product packaging, NOT as a standalone design element'}.
- Do NOT add a large centered brand wordmark, footer brand name, emblem, or standalone logo between headline and product unless the reference explicitly had one there.
- Do NOT pull scraped website logos into the layout as a separate graphic.
- Headlines/taglines carry brand identity when reference is copy-only.
- Product packaging may show its natural printed labels/logos from catalog photos only.
${notes ? `Reference: ${notes}` : ''}`;
  } else if (placement === 'standalone-logo' || placement === 'standalone-and-product') {
    placementRule = `**LOGO PLACEMENT:**
Reference includes a STANDALONE brand logo in the layout — replicate that placement using the user's logotype **from packaging photos** (or dedicated logo catalog image if provided).
${logoOnProductOnly ? 'Logo also appears on product packaging — keep both if reference had both.' : ''}
${notes ? `Reference: ${notes}` : ''}`;
  } else {
    placementRule = `**LOGO PLACEMENT:** Match reference exactly — if unsure, prefer packaging print only (no invented standalone logo).`;
  }

  return `${placementRule}

${packagingLogoRulesBlock(ctx)}`;
}
