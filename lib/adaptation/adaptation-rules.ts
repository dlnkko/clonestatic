import type { AdaptationContext, CopywritingProfile, Line2CopyPattern } from './types';
import { detectSubheroCopyPattern } from './parse-reference-analysis';

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
- Authority/trope claims ("Dermatologist recommended…") in the **subhero** when reference uses a **benefit bridge** ("[Product] helps you …") — credentials belong in badge/footer/spec slots only
- Dropping reference's copy LOGIC and replacing with unrelated marketing phrases from scraped data — scraped data fills CONTENT within reference's rhetorical framework, never replaces the framework
- Using a footer/social-proof line in the wrong slot (e.g. putting credentials where reference had ingredient transparency)
- Leading subhero with clinical/authority copy when reference subhero is emotional outcome-driven (DTC pattern)

**Examples of correct adaptation:**
- Ref: "Less caffeine works better" + silk pillowcase → "Less friction works better" / "Cooler nights work better" (same comparative structure, NOT generic beauty headline)
- Ref: "Every ingredient earns its place. Nothing is here for marketing." + silk → "Every thread earns its place. Nothing is here for filler." (parallel transparency)
- Ref: "FOR A LIMITED TIME: ~~$45~~ $29 →" → use user's promo ONLY in that slot, same visual format, from scraped data
- Ref: "Backed by 700+ clinicians" → user's equivalent credential in footer slot ONLY if reference had that slot; same format, real product data
- Ref: "Magnesium Glycinate 3-in-1 helps you fall asleep faster & stay asleep longer" + silk pillowcase → "Pure silk pillowcase helps you wake with smoother hair & calmer skin" — NOT "Dermatologist recommended mulberry silk…"

Line 2 function: ${ctx.copywritingProfile?.functionOfLine2 ?? 'match reference exactly'}
Line 2 device: ${ctx.copywritingProfile?.linguisticDeviceLine2 ?? 'match reference'}
Line 2 pattern: ${ctx.line2Pattern}
Headline max ${ctx.headlineWords} words · secondary max ${ctx.mainCopyWords} words`;
}

/**
 * Subhero / line-2 copy rules — especially DTC "product helps you [benefit]" pattern.
 */
export function subheroCopyPatternBlockForProfile(
  profile: CopywritingProfile | null,
  pattern: Line2CopyPattern
): string {
  const refLine2 = profile?.referenceLine2Example;
  const template = profile?.line2SentenceTemplate;

  if (pattern === 'product-helps-you') {
    return `**SUBHERO COPY — PRODUCT HELPS YOU (CRITICAL — every DTC-style ad):**
The reference subhero is a **benefit bridge**, NOT a credentials dump.

Reference subhero (pattern only — do NOT copy verbatim): "${refLine2 ?? 'see reference'}"
Sentence template to mirror: ${template ?? '[Product name] helps you [outcome] & [outcome]'}

**YOUR subhero (mainLine / specLine under headline) MUST:**
- Start with the user's product name or formula (from scrape/packaging), then **"helps you"** (or "so you can" / "for") + **specific emotional outcomes** the consumer feels (sleep, hair, skin, energy, comfort, confidence)
- Use scraped benefits as **outcomes inside** the clause — e.g. smoother hair, calmer skin, deeper sleep — NOT as an authority opener
- Match reference **length and rhythm** (often one line, 12–18 words, "&" between two outcomes)

**FORBIDDEN in subhero when reference uses this pattern:**
- "Dermatologist recommended…", "Clinically proven…", "Doctor approved…" as the **lead** (unless reference line 2 literally starts that way)
- Ingredient/spec dumps ("22 momme Grade 6A mulberry silk…") as the whole line when reference was outcome-led
- Generic beauty/filler ("Pure silk. Real beauty.") instead of the helps-you structure

**Where scraped credentials GO instead:** trust badge / award seal, footer, separate spec line, icon labels — only if the reference had those elements in those slots.`;
  }

  if (pattern === 'authority-credential') {
    return `**SUBHERO — AUTHORITY / CREDENTIAL (match reference):**
Reference line 2 is credential-led ("${refLine2 ?? 'see reference'}"). You MAY use scraped authority claims in this slot in the same format — not in a benefit-bridge format.`;
  }

  if (pattern === 'transparency-craft') {
    return `**SUBHERO — TRANSPARENCY / CRAFT (match reference):**
Mirror parallel craft/transparency structure (e.g. "Every X earns its place"). Do NOT replace with dermatologist/authority tropes or generic specs.`;
  }

  if (pattern === 'ingredient-spec') {
    return `**SUBHERO — SPEC / INGREDIENT LINE (match reference):**
Reference line 2 is spec-dense. Use scraped materials/grades in same brevity — not a helps-you emotional bridge unless reference had one.`;
  }

  return `**SUBHERO — MATCH REFERENCE FUNCTION (CRITICAL):**
Reference line 2: "${refLine2 ?? 'see analysis'}"
Function: ${profile?.functionOfLine2 ?? 'same rhetorical role as reference'}
Do NOT replace reference's subhero logic with unrelated scrape tropes (e.g. authority copy when reference was benefit-led).`;
}

export function subheroCopyPatternBlock(ctx: AdaptationContext): string {
  return subheroCopyPatternBlockForProfile(ctx.copywritingProfile, ctx.line2Pattern);
}

export function resolveLine2Pattern(ctx: AdaptationContext): Line2CopyPattern {
  if (ctx.line2Pattern && ctx.line2Pattern !== 'other') return ctx.line2Pattern;
  return detectSubheroCopyPattern(
    ctx.copywritingProfile?.referenceLine2Example,
    ctx.copywritingProfile?.functionOfLine2,
    ctx.copywritingProfile?.linguisticDeviceLine2,
    ctx.copywritingProfile?.line2Pattern ?? null
  ).pattern;
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

export function packagingMirroringBlock(ctx: AdaptationContext): string {
  if (!ctx.referenceShowsPackaging) return '';

  const packagingMatch = ctx.matchedProductVisuals.find((m) => m.role === 'packaging');
  const packagingNote = packagingMatch
    ? `Use the provided **packaging** product image (${packagingMatch.description}).`
    : 'Use a product catalog image that shows **retail packaging** (box, pouch, bottle, jar) — not a loose product flat lay.';

  return `**PACKAGING IN LAYOUT (CRITICAL — mirror reference):**
The reference ad shows the product **both** as the item/units AND as **retail packaging** (bottle, box, pouch, jar, tube) in a distinct layout position (e.g. lower-right hero, beside the stack, foreground packshot).
- You MUST include the **user's retail packaging** in the **same role and position** as the reference — same scale, angle, and corner/zone placement.
- ${packagingNote}
- **FORBIDDEN:** Replacing the reference's packaging slot with another loose product view (e.g. folded pillowcase instead of the product box, extra capsules instead of the bottle).
- The loose/units hero uses the **product** image; the packaging slot uses the **packaging** image — two distinct visuals, same layout grammar as reference.
- Packaging labels, logo, and colors must match the user's packaging photo exactly — do not invent a generic box.`;
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

/**
 * Enforces visual size ladder for all ad types — headline dominant, subheadline subordinate.
 */
export function typographyHierarchyBlock(ctx: AdaptationContext): string {
  const h = ctx.typographyHierarchy;
  const ratio =
    h?.sizeRatioHeadlineToSub?.trim() ||
    'subheadline roughly 28–38% of headline cap height (~⅓ visual size — clearly subordinate)';
  const headlineTier = h?.headlineTier ?? 'largest — primary hook, dominant in the top text zone';
  const subTier =
    h?.subheadlineTier ??
    'clearly smaller than headline — lightweight supporting sans-serif, secondary information only';
  const ladder =
    h?.lines && h.lines.length > 0
      ? h.lines.map((l) => `  - ${l.role}: ${l.sizeTier}${l.weight ? ` (${l.weight})` : ''}`).join('\n')
      : '  - Headline: largest\n  - Subheadline / supporting copy: medium-small\n  - Footer / social proof: smallest';

  const summary = h?.hierarchySummary
    ? `\nReference hierarchy notes: ${h.hierarchySummary}`
    : '';

  return `**TYPOGRAPHY HIERARCHY (CRITICAL — every ad, every layout):**
The generated image MUST respect a clear visual text ladder — same relative sizes as the reference, NOT equal-sized headline and subheadline.

**Mandatory size relationship (image generation):**
- **Headline / primary hook:** ${headlineTier}. This is the ONLY line that should read as "big" in the top text block.
- **Subheadline / subhero (under headline):** ${subTier}. Target scale vs headline: **${ratio}**.
- **Subhero weight:** regular or light only — **never bold or semibold** unless reference subhero was explicitly bold (rare).
- **Subhero line count:** max **2 lines**; tighten tracking/leading so long copy stays visually small.
- **Footer / reviews / legal:** smallest tier — do not enlarge to match subheadline.

Reference text size ladder:
${ladder}
${summary}

**FORBIDDEN (common failure — fix before output):**
- Subheadline or body copy rendered at **nearly the same size** as the headline (looks cluttered; breaks hierarchy)
- Bold, heavy subheadline/subhero that **competes** with the headline for attention
- Subhero at ~50%+ of headline size (common generation failure — always too large)
- Describing only "centered black text" without **explicit relative sizes** per line
- Letting long subheadline copy **inflate** visually because the text is long — **shrink type** to keep hierarchy

**In your final prompt, for EACH text line specify:** font family style, weight, color, alignment, AND **relative size vs headline** (e.g. "subhero in **light** sans-serif at **~30% of headline cap height**, two lines max, centered below headline — noticeably smaller than headline"). Word count limits do NOT replace size hierarchy — a 15-word subhero must still be **visually ~⅓ the headline size**.`;
}
