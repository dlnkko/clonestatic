import type { AdaptationContext, CopywritingProfile, Line2CopyPattern } from './types';
import { detectSubheroCopyPattern } from './parse-reference-analysis';
import { productCatalogFidelityBlock as productCatalogFidelityBlockImpl } from '@/lib/products/product-fidelity';
export { productPlacementOnModelBlock } from './product-placement-rules';
export { creativeBridgeBlock } from './creative-bridge';

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
- **Naming the user's product or "[Brand] helps you…"** when the reference never mentioned a product (curiosity-gap / pain ads) — scraped benefits belong in later funnel steps, NOT in this ad
- Inserting a literal product pitch ("Bloom Creatine Gummies help you build muscle…") when reference only agitated a problem + mystery CTA
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
export function productCreativeProfileBlock(ctx: AdaptationContext): string {
  const p = ctx.productCreativeProfile;
  if (!p) {
    return `**TARGET PRODUCT ANALYSIS:**
Infer from product name, description, and catalog images: primary use cases, who uses it and when, the tension it resolves, and proof points (guarantee, clinical, price). Write natively for THIS product — not the reference competitor.`;
  }
  return `**TARGET PRODUCT ANALYSIS (user product — native concept rebuild):**
- **Use cases:** ${p.primaryUseCases}
- **Audience / when:** ${p.audience}
- **Core tension:** ${p.tension}
- **Resolution:** ${p.resolution}
- **Proof points:** ${p.proofPoints.length ? p.proofPoints.join('; ') : 'use only verified product/scrape data'}
- **Brand tone:** ${p.brandTone}

Use this to rebuild the reference **concept** for the user's product — not a visual swap.`;
}

/** Extrapolate the reference's real marketing angle to the user's product category. */
export function marketingAngleExtrapolationBlock(ctx: AdaptationContext): string {
  const angle = ctx.marketingAngle;
  const productAnchor = ctx.productName
    ? `**User product:** ${ctx.productName} — symptoms, audience, and metaphor MUST match this category, NOT the reference competitor niche.`
    : '**User product:** from scrape — anchor symptoms and metaphor to that category.';

  if (!angle) {
    return `**MARKETING ANGLE EXTRAPOLATION (CRITICAL):**
${productAnchor}
Read ALL reference text lines together — identify the REAL problem being sold (not the literal object in the photo).
Extrapolate that same persuasive angle to the user's product category. If reference never names a product, adapted copy must NOT name the user's product either.`;
  }

  return `**MARKETING ANGLE EXTRAPOLATION (CRITICAL — read before writing any line):**
${productAnchor}
- **What this ad is REALLY about:** ${angle.realTopic}
- **Audience:** ${angle.targetAudience || 'match reference audience, translated to user product buyers'}
- **Core pain:** ${angle.painPoint || 'same tension, new category'}
- **Funnel:** ${angle.funnelStage} — ${angle.funnelStage === 'curiosity-gap' ? 'NO product reveal; mystery CTA only' : 'mirror reference reveal level'}
- **Product mentioned in reference copy:** ${angle.productMentionedInCopy ? 'yes — you may name user product at same slot/depth' : 'NO — forbidden to name user product, brand, or "X helps you" anywhere'}
- **Headline role:** ${angle.headlineRhetoricalRole || 'match reference headline function'}
- **How to adapt:** ${angle.copyExtrapolationNotes || 'Same angle, new category symptoms/outcomes — never paste scrape as a product pitch if reference was curiosity-led'}

**FORBIDDEN:** Turning a curiosity/problem ad into a product description. Scraped specs are for subtext slots ONLY when reference had them — not a new "helps you" line invented from the product page.`;
}

/** When reference hero is symbolic, create an analogous visual for the user's audience. */
export function visualMetaphorExtrapolationBlock(ctx: AdaptationContext): string {
  const meta = ctx.visualMetaphor;
  const productNote = ctx.productName
    ? `User product: **${ctx.productName}** — metaphor object must relate to THIS category's failure state (fitness/supplement → gym performance symbol; NOT unrelated organic blobs).`
    : 'Anchor metaphor to scraped product category.';

  if (!meta?.present) {
    return `**VISUAL METAPHOR (check reference):**
${productNote}
If the reference hero is a symbolic object (not the competitor's product), you MUST invent an **analogous metaphor** for the user's product/audience — same idea, new object, **clear and literal** (deflated ball, slack band, wilted leaf). Do NOT use abstract pink shapes or brains. Do NOT drop a generic product packshot when reference used symbolism.`;
  }

  return `**VISUAL METAPHOR EXTRAPOLATION (CRITICAL):**
${productNote}
Reference uses symbolism — NOT a literal product hero.
- **Literal subject:** ${meta.visualSubject}
- **What it means:** ${meta.symbolicMeaning}
- **Tie to headline:** ${meta.connectionToHeadline}
- **Adapt for user product:** ${meta.adaptationGuidance || 'Create parallel metaphor for user category (e.g. deflated/wilted/flat object echoing the same bodily or performance failure — then user product only if reference showed product at end, which it did not)'}

**MANDATORY:**
- Hero visual = **new analogous symbol** for user's audience/problem — NOT random catalog product stacked prettily
- Headline word (e.g. "Deflated"/"Flat") must **visually match** the symbol (wilted, collapsed, slack) — FAIL if headline says "Flat" but image shows plump/full objects
- User's actual product appears ONLY if reference showed product; otherwise omit product image or use tiny CTA-zone placement only

**FORBIDDEN:**
- Abstract unrecognizable blobs, brain shapes, or random organic forms
- Copying reference's exact metaphor object when category differs (eggplant → use fitness-appropriate symbol for creatine)
- Replacing a phallic/body/performance metaphor with unrelated plump gummies or catalog packshots
- Ignoring symbolic meaning and photographing catalog SKUs as the hero`;
}

export function subheroCopyPatternBlockForProfile(
  profile: CopywritingProfile | null,
  pattern: Line2CopyPattern
): string {
  const refLine2 = profile?.referenceLine2Example;
  const template = profile?.line2SentenceTemplate;

  if (pattern === 'curiosity-gap') {
    return `**SUBHERO / BODY — CURIOSITY GAP (CRITICAL — no product pitch):**
Reference builds **mystery** — problem agitation + curiosity CTA. Reference body pattern: "${refLine2 ?? 'see reference'}"
Template: ${template ?? "You're [situation]. [Symptom]. [Symptom]. [Symptom]. But nobody told you why."}

**YOUR body/mainLine MUST:**
- Mirror reference **structure**: dismissals/strikethroughs (if any) → one-word punch headline → symptom triad in second person → curiosity hook (NOT product benefits)
- Translate symptoms to the **user's product category audience** — REQUIRED rewrite, not paraphrase of reference niche (e.g. creatine/fitness: "You're grinding in the gym but progress stalled. Your strength. Your reps. Your recovery." — NOT "night performance" / libido copy from a different ad category)
- CTA mirrors reference ("See the 'why' →" / "Get the 'fuel' →") — tease, do NOT explain the product

**FORBIDDEN:**
- "[Product name] helps you…" or any brand name in body copy
- Explaining product benefits, ingredients, or "build lean muscle" when reference never did
- Scraped marketing copy pasted as a subhero product pitch`;
  }

  if (pattern === 'pain-agitation') {
    return `**SUBHERO — PAIN AGITATION (no product name):**
Reference agitates the problem without naming product. Pattern: "${refLine2 ?? 'see reference'}"
**FORBIDDEN:** Product name, "helps you", ingredient specs — unless reference had them.`;
  }

  if (pattern === 'benefit-bullet-list') {
    return `**SUBHERO COPY — BENEFIT LIST (CRITICAL — comma / rhythm list):**
Reference subhero uses a **short parallel list** (e.g. "8 hrs of hydration, no sticky finish, a personalized pink") — NOT a helps-you sentence and NOT authority copy.

Reference pattern: "${refLine2 ?? 'see reference'}"
Template: ${template ?? '[duration/amount] of [benefit], no [pain point], [outcome]'}

**YOUR subhero MUST:**
- Keep the **same grammar**: number/duration + benefit, "no" + problem removed, final outcome phrase
- Adapt facts from scrape to the user's product category (silk: glide/creases/hair; sleep: hours/rest; etc.)
- Stay **one line or two short lines max** — same rhythm as reference

**FORBIDDEN:** "Dermatologist recommended…" lead, long spec paragraph, or sizing that visually matches the hero headline.`;
  }

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

/** Every ad: scene/props must match product category while keeping reference aesthetic. */
export function productThemedEnvironmentBlock(ctx: AdaptationContext): string {
  const productHint = ctx.productName ? ` ("${ctx.productName}")` : '';
  const graphicNote =
    ctx.isGraphicOnly || ctx.hasIllustrativeVisual
      ? `- **Graphic/illustration ads:** swap props, motifs, and background graphics to the user's product category while keeping the same visual medium. Do NOT keep competitor-category graphics (bedding, coffee, etc.) when the product is fitness, beauty, etc.`
      : `- **Photo/environment ads:** replace setting, surfaces, architecture, and props when they belong to a different category than the user's product.`;

  return `**PRODUCT-THEMED ENVIRONMENT (CRITICAL — every ad, every category):**
Analyze the user's product${productHint} — category, use case, audience — and make the scene **100% on-theme for THAT product**, not the reference competitor's world.

**Keep from reference (always):**
- Layout structure, text zones, composition grammar, camera angle family, full-bleed framing
- Production quality and **aesthetic mood**: soft editorial light, high-key minimal, moody premium, etc.
- Typography placement, color roles, shadow style, depth, premium DTC feel

**Replace when category differs (always):**
- Physical setting and props must reflect the **user's product world**, not the competitor's
- Creatine / protein / pre-workout → modern gym, fitness studio, athletic counter, shaker, dumbbells — **same soft light and minimalist aesthetic**, NOT bedroom/bedding/kitchen from reference
- Bedding / sleep → bedroom, nightstand, soft textiles
- Skincare / beauty → vanity, bathroom, spa surfaces
- Food / beverage → kitchen or dining only when the product is actually food

${graphicNote}

**People (when reference has models):** keep headcount and shot framing; shift setting, wardrobe, and interaction to the user's product category.

**Environment still-life (no people):** replace surfaces/props/background to match product theme — preserve reference lighting mood and product placement zones only.

**FORBIDDEN:**
- Copying competitor category props (sheets, coffee, competitor lifestyle) when the user's product is a different category
- Keeping a reference bedroom/kitchen scene just because it looks nice when the product is fitness/sports/supplements

**REQUIRED in final prompt:** explicit on-theme environment, surfaces, and contextual props for the user's product category at the same aesthetic quality tier as the reference.`;
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
- **Do NOT** generate a hyperrealistic photograph, sweaty fitness model, glossy muscle macro, or lifestyle scene when the reference uses stylized/illustrated anatomy or graphics.
- **Do NOT** "upgrade" a soft stylized arm/body graphic into photoreal skin, pores, or gym photography — keep the same illustrated/animated rendering style.
- **DO** recreate the same **visual medium**: stylized illustration, anatomical diagram, cutaway, 3D render, animated/educational graphic, or icon-led layout.
- Adapt the illustration **concept** to the user's product category while keeping reference composition:
  * Reference: anatomical head/brain + product → User product: equivalent diagram (fabric layers, sleep science graphic, thread cross-section, etc.) + user's product centered
  * Reference: ingredient callout lines to drink → User: callout lines to product features/materials from scraped data
  * Reference: circular portrait crop → If reference is illustration-based, use illustrated/stylized product hero — NOT a real face photo
- Match reference: line weights, transparency effects, glow, diagram labels, product placement zone.
- Notes from reference: ${notes}
- Image generation mode: **design/graphic** — describe as illustration, diagram, or stylized render explicitly in the prompt.`;
}

export function productCatalogFidelityBlock(ctx: AdaptationContext): string {
  return productCatalogFidelityBlockImpl(ctx);
}

export function packagingMirroringBlock(ctx: AdaptationContext): string {
  if (!ctx.referenceShowsPackaging) return '';

  return `**PACKAGING IN LAYOUT (position only — re-pose freely):**
Reference may show packaging in a distinct zone (e.g. lower-right hero).
- Place user's retail packaging from catalog in the same zone/scale relationship — re-angle and re-light as needed for composition.
- Match container type from catalog (pouch, box, tub) — never copy reference competitor bottle shape.
- Packaging labels and colors must match catalog exactly.`;
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
 * Mirrors reference top-text layout (stacked center, eyebrow → hero → subhero).
 */
export function textLayoutBlock(ctx: AdaptationContext): string {
  const layout = ctx.referenceTextLayout;
  const lines = ctx.referenceTextLines;
  const lineList =
    lines.length > 0
      ? lines.map((l) => `  - [${l.role}]: mirror placement & tier`).join('\n')
      : '  - eyebrow (if any) → hero headline → subhero → modules below';

  const align = layout?.alignment ?? 'center';
  const stack = layout?.stackDirection ?? 'vertical';
  const eyebrow = layout?.hasEyebrow
    ? `Eyebrow: ${layout.eyebrowStyle ?? 'smallest caps, wide tracking, above hero'}`
    : 'No eyebrow line in reference — do not add one unless approved copy includes brandName as eyebrow.';

  return `**TEXT LAYOUT & ALIGNMENT (CRITICAL — match reference structure):**
- **Alignment:** All top copy **${align}-aligned** (same as reference — if reference is centered stack, every line centered; do NOT left-align a centered reference).
- **Stack:** **${stack}** text flow — preserve top-to-bottom order: ${lineList}
- ${eyebrow}
- **Hero headline:** ${layout?.heroStyle ?? 'largest serif/display — only dominant text line'}
- **Subhero:** ${layout?.subheroStyle ?? 'much smaller sans-serif directly under hero — must NOT match hero width/weight'}
${layout?.layoutNotes ? `- Reference notes: ${layout.layoutNotes}` : ''}

**FORBIDDEN layout mistakes:**
- Subhero rendered as wide as hero or same visual weight (breaks premium DTC look)
- Reordering lines (e.g. putting credentials above emotional hook when reference had eyebrow → hook → benefits)
- Adding extra text blocks not in reference`;
}

/**
 * Before/after comparison — natural side-by-side, not weird split-face.
 */
export function layoutProportionsBlock(ctx: AdaptationContext): string {
  const zones = ctx.referenceLayoutZones;
  const comp = ctx.referenceComparisonParsed;
  if (!zones && !ctx.hasReferenceComparisonModule) return '';

  const header = zones?.headerBandPercent ?? '~25-35% of frame height';
  const main = zones?.mainModulePercent ?? '~65-75% of frame height';
  const notes = zones?.layoutNotes || comp?.placement || '';

  return `**LAYOUT PROPORTIONS (CRITICAL — match reference bands, NOT equal halves):**
- **Top band (headline + product/packaging hero):** ${header} — compact header zone only
- **Main module band (comparison / large visual):** ${main} — dominant area below header
${notes ? `- Reference notes: ${notes}` : ''}
- **FORBIDDEN:** Splitting the ad 50/50 top/bottom when reference has a **small header + large comparison** module
- **FORBIDDEN:** Enlarging the top product zone to half the frame when reference keeps product+text in a narrow upper band
- Product/packaging hero uses **catalog packaging photo** in the top band when reference shows a labeled bottle/box/tube — NOT a random lifestyle scene on grass`;
}

export function beforeAfterComparisonBlock(ctx: AdaptationContext): string {
  if (!ctx.hasReferenceComparisonModule) return '';

  const mod = ctx.referenceComparisonParsed;
  const blueprint = ctx.referenceComparisonModule?.slice(0, 2000) ?? '';

  return `**BEFORE / AFTER COMPARISON (CRITICAL — natural, not uncanny):**
The reference includes a comparison visual. Recreate the **same module type** with the user's product benefits — but it must look **professional**, never "weird."

Reference blueprint:
${blueprint || '(see reference analysis)'}

${layoutProportionsBlock(ctx)}

**MANDATORY rules (every comparison ad):**
- **Layout:** ${mod?.layoutType || 'Two equal side-by-side panels (left Before, right After)'} — clean vertical gutter or soft blend between panels. **NEVER** a harsh single-photo vertical slice bisecting one face down the middle (common failure — looks uncanny).
- **Subject framing:** ${mod?.subjectFraming || 'Match reference crop ONLY'} — if reference shows **lip close-up**, use lip close-up; if **hair strand**, use hair; if **product texture**, use product. **Do NOT** zoom out to full face/portrait when reference was macro/feature crop.
- **Labels:** ${mod?.labelStyle || 'Small italic serif "Before" / "After" in bottom corner of each panel'} — subtle, smaller than subhero text.
- **Transition:** ${mod?.transitionStyle || 'Soft panel edge or natural side-by-side — no laser split, no mismatched lighting halves on one face'}
- **Placement:** ${mod?.placement || 'Middle band between headline block and product shot'}
- Same model/skin tone on both panels if same person; believable before problem + after improvement for the **user's** product category
- Consistent lighting and color grade across both panels

**FORBIDDEN:**
- Full-face vertical split with different hair/skin on each half
- Oversized Before/After labels competing with headline
- Random stock portrait that does not match reference framing
- Comparison module omitted when reference had one`;
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

  const layoutHint = ctx.referenceTextLayout
    ? `\n**Layout:** ${ctx.referenceTextLayout.stackDirection} stack, ${ctx.referenceTextLayout.alignment}-aligned — preserve this geometry for all approved copy lines.`
    : '';

  return `**TYPOGRAPHY HIERARCHY (CRITICAL — every ad, every layout):**
The generated image MUST respect a clear visual text ladder — same relative sizes as the reference, NOT equal-sized headline and subheadline.${layoutHint}

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

/** Match N reference product units to N user catalog photos (flavor/color variants). */
export function productVariantMatchingBlock(ctx: AdaptationContext): string {
  const units = ctx.referenceProductUnits;
  if (!units || units.unitCount <= 1) return '';

  const distinct = units.distinctVariants;
  const catalogCount = ctx.matchedProductVisuals.filter(
    (m) => m.role === 'product' || m.role === 'packaging'
  ).length;

  return `**PRODUCT VARIANT ROW (CRITICAL):**
Reference shows **${units.unitCount}** product unit(s) in the hero row (${units.arrangement}).
${distinct ? 'These are **distinct variants** (different flavors/colors/packaging) — NOT three copies of the same SKU.' : 'These are **identical repeated units** — same packaging photo may repeat.'}

**Your generated ad MUST:**
- Show exactly **${Math.min(units.unitCount, Math.max(catalogCount, 1))}** visible unit(s) — mirror reference count, capped by user catalog photos uploaded (${catalogCount} variant photo(s) available)
- Preserve reference **arrangement** (${units.arrangement}) and **relative scale/spacing** between units
- Assign each slot left-to-right the corresponding catalog variant photo — never swap variant order randomly
${distinct && catalogCount < units.unitCount ? `- User has fewer variant photos (${catalogCount}) than reference units (${units.unitCount}) — show ${catalogCount} distinct variant(s), do NOT duplicate one flavor to fake ${units.unitCount} variants` : ''}
${units.variantNotes ? `Reference variant notes: ${units.variantNotes}` : ''}`;
}

/** Prevent invented subscription CTAs when reference did not use them. */
export function ctaSubscriptionGuardBlock(ctx: AdaptationContext): string {
  const refCtaLines = ctx.referenceTextLines.filter((l) => /cta|button|call/i.test(l.role));
  const refCtaText = refCtaLines.map((l) => l.text).join(' ').toLowerCase();
  const refHasSubscribe =
    /\bsubscribe\b|\bsubscription\b|\bauto-?ship\b|\bmembership\b|\bjoin and save\b/i.test(refCtaText);
  const refHasSaveOffer = /\bsave \d|save \$\d|\d+% off|\bflash sale\b/i.test(refCtaText);

  if (refHasSubscribe) {
    return `**CTA:** Reference CTA includes subscription language — you may mirror subscription phrasing structure only (not competitor brand names).`;
  }

  return `**CTA / OFFER BAR (CRITICAL — do NOT invent):**
Reference CTA/button text does NOT include "Subscribe", "Subscribe & Save", "auto-ship", or recurring membership offers.
- **FORBIDDEN in CTA/footer bar:** "Subscribe and Save", "Subscribe & Save", "Join and save", auto-ship, membership, recurring delivery
${refHasSaveOffer ? '- Reference had a save/discount line — mirror that structure with allowed pricing only' : '- Do NOT add "% off", "Save X%", or flash-sale language unless reference had a dedicated promo line'}
- Use a **direct purchase CTA** aligned with reference tone (e.g. "Shop now", "Get yours", promo code bar) — NOT subscription commerce unless reference had it
- If allowed price is set (${ctx.allowedPrice ?? 'none'}), price may appear once — never pair with fake subscription savings`;
}

/** Real photographic people — match reference camera grammar (candid iPhone, not AI stock). */
export function realPersonPhotoStyleBlock(ctx: AdaptationContext): string {
  if (!ctx.hasPersonInReference || ctx.hasIllustrativeVisual) return '';

  const refNotes = ctx.referencePhotoStyle?.trim();

  return `**REAL PHOTO AUTHENTICITY — MATCH REFERENCE CAMERA FEEL (CRITICAL):**
The reference uses **real photographic people**. Clone the reference **photography grammar** — NOT a generic polished stock/AI fitness shoot.

**Match from reference (mandatory):**
- **Framing & distance:** Same shot distance — if reference is **tight close-up / face-forward / cropped shoulders**, keep that intimacy; do NOT zoom out to a generic half-body catalog pose unless reference was wide.
- **Expression & energy:** Mirror reference mood — joyful scream, candid laugh, mid-moment excitement, relaxed confidence. Model must feel **alive with personality**, not neutral stock-smile.
- **Camera feel:** If reference has **slight motion blur, handheld shake, candid snapshot energy, festival/concert spontaneity, or imperfect focus**, reproduce that **authentic captured-moment** quality — do NOT over-sharpen into glossy AI/stock realism.
- **Device aesthetic:** Photo must read as **shot on iPhone / modern smartphone** — natural HDR, realistic skin texture with minor imperfections, authentic depth, slight wide-lens distortion if close-up. **NOT** hyper-retouched commercial render, **NOT** obvious AI smooth skin, **NOT** studio catalog backdrop.
- **Lighting:** Match reference lighting character (golden hour, mixed venue lights, on-phone flash, etc.) — natural and situational.

${refNotes ? `Reference photography analysis:\n${refNotes}\n` : ''}**FORBIDDEN:**
- Generic supplement/fitness stock (track at sunset, perfect abs, holding pill to mouth) unless reference literally shows that
- Over-polished "AI influencer" skin, plastic symmetry, uncanny perfect teeth
- Replacing reference **intimate close-up energy** with a distant conventional lifestyle shot
- Removing motion/candid imperfection when reference had festival/snapshot authenticity

**REQUIRED in final prompt:** Explicitly state **smartphone/iPhone candid photo quality** + reference framing + expression + any motion/handheld feel, while keeping **exact ad layout, typography, and text design**.`;
}
