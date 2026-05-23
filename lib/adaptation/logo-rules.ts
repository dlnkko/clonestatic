import type { AdaptationContext } from './types';

/** Shared instructions so agents do not invent a centered/wordmark logo when reference is copy-only. */
export function logoPlacementRulesBlock(ctx: AdaptationContext): string {
  const { placement, standaloneLogoInLayout, logoOnProductOnly, notes } =
    ctx.referenceLogoAnalysis;

  if (
    placement === 'copy-only' ||
    placement === 'logo-on-product-only' ||
    (!standaloneLogoInLayout && placement !== 'standalone-logo' && placement !== 'standalone-and-product')
  ) {
    return `**LOGO RULE (CRITICAL):**
Reference brand presentation = ${placement === 'copy-only' ? 'COPY/TEXT ONLY at top — no separate logo mark in the layout' : 'logo ONLY on product packaging, NOT as a standalone design element'}.
- Do NOT add a large centered brand wordmark, emblem, or standalone "brand logo" between headline and product.
- Do NOT pull the scraped website logo into the layout as a graphic element.
- Headlines/taglines carry brand identity (like the reference: e.g. "Pretty... and Practical" with no GOAT logo in the middle).
- Product may show its natural packaging labels from the uploaded product image only.
${notes ? `Reference: ${notes}` : ''}`;
  }

  if (placement === 'standalone-logo' || placement === 'standalone-and-product') {
    return `**LOGO RULE:**
Reference includes a STANDALONE brand logo in the layout — replicate that placement with the user's brand (not an extra logo in addition to reference layout).
${logoOnProductOnly ? 'Logo also appears on product packaging — keep both if reference had both.' : ''}
${notes ? `Reference: ${notes}` : ''}`;
  }

  return `**LOGO RULE:** Match reference exactly — if unsure, prefer NO standalone logo (copy-only + product packaging only).`;
}
