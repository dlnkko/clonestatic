import type { AdaptationContext } from './types';

/**
 * Rules for mirroring reference ad copy structure with user product data.
 * Applied to copy agent, synthesis, and QA.
 */
export function referenceCopyMirroringBlock(ctx: AdaptationContext): string {
  const lines = ctx.referenceTextLines;
  const headlineEx = ctx.copywritingProfile?.referenceHeadlineExample;
  const line2Ex = ctx.copywritingProfile?.referenceLine2Example;

  const linesBlock =
    lines.length > 0
      ? lines.map((l, i) => `  ${i + 1}. [${l.role}] "${l.text}"`).join('\n')
      : headlineEx
        ? `  Headline pattern: "${headlineEx}"\n  Line 2 pattern: "${line2Ex ?? 'see reference'}"`
        : '  (mirror every visible line from reference analysis)';

  return `**COPY MIRroring METHOD (CRITICAL — every ad, every line):**
For EACH text line in the reference ad, follow this process:
1. **IDENTIFY** the rhetorical function (contrarian benefit, transparency/craft, urgency promo, social proof footer, feature callout, etc.)
2. **EXTRACT** the sentence structure/pattern (comparative + outcome, parallel "X earns its place", strikethrough price + arrow, etc.)
3. **REWRITE** using the USER's product data while keeping the SAME structure, tone, brevity, and persuasive logic

Reference text lines (patterns to mirror — do NOT copy verbatim):
${linesBlock}

**FORBIDDEN copy mistakes:**
- Generic category headlines ("Pure silk. Real beauty.") when reference uses a specific rhetorical pattern ("Less caffeine works better")
- Authority/trope claims ("Dermatologist recommended…") when reference uses transparency/craft messaging ("Every ingredient earns its place. Nothing is here for marketing.")
- Dropping reference's copy LOGIC and replacing with unrelated marketing phrases from scraped data — scraped data fills CONTENT within reference's rhetorical framework, never replaces the framework
- Using a footer/social-proof line in the wrong slot (e.g. putting credentials where reference had ingredient transparency)

**Examples of correct adaptation:**
- Ref: "Less caffeine works better" + silk pillowcase → "Less friction works better" / "Cooler nights work better" (same comparative structure, NOT generic beauty headline)
- Ref: "Every ingredient earns its place. Nothing is here for marketing." + silk → "Every thread earns its place. Nothing is here for filler." (parallel transparency)
- Ref: "FOR A LIMITED TIME: ~~$45~~ $29 →" → use user's promo ONLY in that slot, same visual format, from scraped data
- Ref: "Backed by 700+ clinicians" → user's equivalent credential in footer slot ONLY if reference had that slot; same format, real product data

Line 2 function: ${ctx.copywritingProfile?.functionOfLine2 ?? 'match reference exactly'}
Line 2 device: ${ctx.copywritingProfile?.linguisticDeviceLine2 ?? 'match reference'}
Headline max ${ctx.headlineWords} words · secondary max ${ctx.mainCopyWords} words`;
}

export function backgroundColorAdaptationBlock(ctx: AdaptationContext): string {
  const hasBranding = Boolean(ctx.scrapedBranding);
  return `**BACKGROUND & COLOR ADAPTATION (CRITICAL):**
- Do NOT copy the reference competitor's product-category colors (coffee brown, food tones, competitor brand palette) when adapting to a different product.
- **Use the USER's product brand colors** from scraped branding / product packaging for backgrounds, gradients, and accent bars.
- Keep the reference's color **ROLE and mood** (dark premium, light minimal, high-contrast CTA bar, highlight strip) but swap the **actual hue** to match user branding.
- Example: reference dark coffee-brown background + silk pillowcase product → dark navy/charcoal/silver from slip branding, NOT brown.
- Highlight bars, CTA strips, and glow effects: adapt color to product brand while keeping same placement and weight as reference.
${hasBranding ? '- Product brand colors are in Brand Integration below — prioritize them for background and accents.' : '- Derive palette from the product image (packaging colors, dominant tones) when branding data is limited.'}`;
}

export function illustrativeVisualBlock(ctx: AdaptationContext): string {
  if (!ctx.hasIllustrativeVisual) return '';

  const vs = ctx.referenceVisualStyle;
  const notes = vs?.illustrationNotes || 'illustration/diagram as in reference';

  return `**ILLUSTRATION / DIAGRAM VISUAL (CRITICAL — NOT a real person photo):**
The reference ad uses **${vs?.visualMedium ?? 'illustration'}** — NOT a stock photo of a real person.
- **Do NOT** generate a realistic photograph of a sleeping person, model, or lifestyle scene unless the reference is a real photo.
- **DO** recreate the same **visual medium**: stylized illustration, anatomical diagram, cutaway, 3D render, animated graphic, or icon-led layout.
- Adapt the illustration **concept** to the user's product category while keeping reference composition:
  * Reference: anatomical head/brain + product → User product: equivalent diagram (fabric layers, sleep science graphic, thread cross-section, etc.) + user's product centered
  * Reference: ingredient callout lines to drink → User: callout lines to product features/materials from scraped data
  * Reference: circular portrait crop → If reference is illustration-based, use illustrated/stylized product hero — NOT a real face photo
- Match reference: line weights, transparency effects, glow, diagram labels, product placement zone.
- Notes from reference: ${notes}
- Image generation mode: **design/graphic** — describe as illustration, diagram, or stylized render explicitly in the prompt.`;
}

export function noStockPhotoUnlessReferenceBlock(ctx: AdaptationContext): string {
  if (ctx.hasPersonInReference) return '';
  if (ctx.hasIllustrativeVisual) {
    return `**NO REAL PEOPLE (reference has no photo models):**
The reference does NOT use real photographic people. Do NOT add stock photos, sleeping models, lifestyle portraits, or human faces. Use the reference visual medium (illustration/diagram/product graphic) instead.`;
  }
  if (ctx.isGraphicOnly) {
    return `**NO REAL PEOPLE (graphic-only reference):**
Keep product + graphics only. No people, no faces, no lifestyle models.`;
  }
  return '';
}
