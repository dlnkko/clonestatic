/**
 * Prompts canónicos de oldprompts.md — Step 1 (análisis) y Step 2 (finalPromptGeneration).
 * Usados por: generate-static-ad-prompt (Step 1), agente de adaptación, legacy Step 2.
 */
import type { AdaptationContext, CopyAdaptationResult, VisualAdaptationResult } from './types';
import { logoPlacementRulesBlock } from './logo-rules';
import {
  backgroundColorAdaptationBlock,
  beforeAfterComparisonBlock,
  illustrativeVisualBlock,
  layoutProportionsBlock,
  marketingAngleExtrapolationBlock,
  noStockPhotoUnlessReferenceBlock,
  packagingMirroringBlock,
  productCatalogFidelityBlock,
  productCreativeProfileBlock,
  productPlacementOnModelBlock,
  productThemedEnvironmentBlock,
  referenceCopyMirroringBlock,
  subheroCopyPatternBlock,
  textLayoutBlock,
  typographyHierarchyBlock,
  visualMetaphorExtrapolationBlock,
} from './adaptation-rules';
import { creativeBridgeBlock } from './creative-bridge';
import type { CopywritingProfile, ReferenceTextLayout } from './types';

export function featureRowInstructionsBlock(ctx: AdaptationContext): string {
  if (!ctx.hasReferenceFeatureRow || !ctx.referenceFeatureRow) return '';
  return `**ICON / FEATURE ROW (MANDATORY — clone layout, adapt labels):**
The reference ad includes a row of icons with short labels. You MUST include this row in the final image with the SAME count, order, icon style (line weight, size), spacing, and placement relative to headline/product.
Blueprint from reference:
---
${ctx.referenceFeatureRow}
---
Use the adapted icon labels from the copy agent. Do NOT omit the icon row. Do NOT replace with different UI (badges, bullets only, or extra headline).`;
}

export function formatApprovedCopyBlock(
  copy: CopyAdaptationResult,
  profile?: CopywritingProfile | null,
  textLayout?: ReferenceTextLayout | null
): string {
  const lines =
    copy.textLines && copy.textLines.length > 0
      ? copy.textLines.map((l) => `- [${l.role}]: "${l.text}"`).join('\n')
      : `- Tagline/headline: "${copy.tagline}"\n- Main line: "${copy.mainLine}"`;

  const icons =
    copy.featureIcons && copy.featureIcons.length > 0
      ? `\n**Feature icon row (EXACT labels, same order):**\n${copy.featureIcons
          .map(
            (ic, i) =>
              `${i + 1}. Icon: ${ic.iconDescription} — label "${ic.label}"`
          )
          .join('\n')}`
      : '';

  const subheroRender =
    '\n**Subhero typography in image:** light/regular sans-serif only, ~28–38% of headline cap height (≈⅓ size), max 2 lines — must look clearly smaller than headline.';
  const layoutRender = textLayout
    ? `\n**Text block layout:** ${textLayout.alignment}-aligned ${textLayout.stackDirection} stack (mirror reference).`
    : '';

  const lineCount = copy.textLines?.length ?? 0;

  return `**Approved copy — use EXACTLY this visible text in the ad (each line ONCE, ${lineCount} lines total — NEVER repeat any line):**
${lines}
${subheroRender}
${copy.brandName && !copy.textLines?.some((l) => /brand/i.test(l.role)) ? `- Brand name: "${copy.brandName}"` : ''}
${copy.brandSubtagline && !copy.textLines?.some((l) => /subtagline|sub-tagline/i.test(l.role)) ? `- Brand sub-tagline: "${copy.brandSubtagline}"` : ''}
${copy.specLine && !copy.textLines?.some((l) => /spec/i.test(l.role)) ? `- Spec/credentials line: "${copy.specLine}"` : ''}
${layoutRender}
${copy.reviewText ? `- Review/testimonial: "${copy.reviewText}"` : ''}
${copy.reviewNumericClaims ? `- Review numbers (scrape only): "${copy.reviewNumericClaims}"` : ''}
${icons}`;
}

/** Step 1 — staticAdAnalysisPrompt (+ detección iconos y logo en layout) */
export function getStaticAdAnalysisPrompt(): string {
  return `You are an expert direct-response advertising strategist AND prompt engineer. Your job is NOT to do a visual swap of the reference ad — extract the underlying **creative concept** and document it so another system can rebuild it natively for a new product.

Analyze the provided static ad image. Produce a structured deconstruction FIRST, then a detailed layout prompt for replication reference.

Your task:

1. **Identify Copywriting Characteristics and BREVITY** (for later adaptation):
    - **Text structure**: Count EVERY visible text element top-to-bottom (brand name, brand sub-tagline, headline, spec/credentials line, CTA, icon labels, etc.) — NOT just two lines. Example: "Brand SILUXE + sub-tagline + serif headline + sans spec line + 4 icon labels". Count words PER LINE separately.
    - **All text lines (top to bottom):** List each line with its exact reference text and role (dismissal-strikethrough-1, dismissal-strikethrough-2, headline-punch, body, cta, brand-name, spec-line, icon-label, etc.) — **one row per visible line, never duplicate the same text twice**.
    - Count the EXACT number of words in the main headline/tagline (first line) and in the main copy/slogan (second line or main block) separately.
    - Identify the rhetorical figure used (metaphor, personification, hyperbole, analogy, slogan, motivational, aspirational, etc.)
    - Note the tone (friendly, professional, playful, serious, etc.)
    - Note the style category (corto y persuasivo, humor, irónico, directo, emocional, etc.)

2. **Extract Typography + VISUAL HIERARCHY from Reference Ad (CRITICAL):**
    - Describe font style/type, weights, placement, alignment, effects — AND the **relative visual size** of each text tier (headline vs subheadline vs footer). The subheadline is often LONG in word count but must still be **visually smaller** than the headline — capture that ratio.

3. **Identify VISUAL STYLE / DESIGN TYPE** (CRITICAL — do not add people or gym if reference has none):
    - Does the reference ad show a **real photographic** person or model (actual camera photo with skin pores, photographic depth of field)? (yes/no)
    - **NOT a real photo:** stylized/animated/illustrated body parts (soft-rendered arm, anatomical diagram, educational cross-section, vector silhouette, 3D mannequin, glossy CGI anatomy) → answer **no** for real photographic person even if human anatomy is visible.
    - Does the reference use **illustration, diagram, cutaway, 3D render, or animated/stylized graphic** (e.g. anatomical arm/head, brain diagram, soft educational body graphic, icon graphics, vector art)? (yes/no)
    - **Illustration/diagram type:** If yes above, describe precisely (e.g. soft stylized upper-arm anatomy graphic, anatomical cutaway, flat illustration, 3D product render, ingredient callout diagram). If no, write "none".
    - **Visual medium:** Choose exactly one: photo | illustration | diagram | 3d-render | mixed | product-graphic-only
    - Use **mixed** when photoreal product packaging is composited with illustrated/stylized body graphics or diagrams in the same layout.
    - Does the reference ad show ANY gym, sport setting, or location environment? (yes/no)
    - **Number of main visual elements:** one-hero-only OR multiple (use **multiple** when reference shows loose units/items AND a separate bottle/box/pouch/jar packshot — e.g. capsules + supplement bottle)
    - **Retail packaging visible as its own element:** Is a bottle, box, pouch, or jar shown as a distinct packshot (not only loose product)? (yes/no)
    - **Has person/character (legacy):** yes only if REAL photographic person; no if only illustration/diagram of human anatomy
    - If illustration/diagram-led: adaptation must STAY in that medium — do NOT convert to stock photo of real person
    - If NO real photo person and NO gym: "graphic-product-only" or "illustration-led"
    - If it HAS a **real photographic** person: keep same shot type; user's product in authentic use

4. **PRODUCT POSE, POSITION AND PLACEMENT (CRITICAL — identify exactly for replication):**
    - **Product pose/orientation:** How is the product displayed? (e.g. **lying down** flat or at an angle, **standing upright**, on its side, **scattered** at various angles, grouped in a row, stacked). Describe precisely: "lying down and slightly angled", "standing upright facing camera", "multiple items scattered with different tilts", etc. This MUST be replicated in the generated ad so the new product appears in the SAME pose — e.g. if the reference shows earplugs lying down and scattered, the new product must also be shown lying down and at similar angles, NOT standing upright.
    - Is the product **inclined/tilted**? Describe the angle (e.g. leaning down and to the right, tilted left, diagonal). Exact orientation matters.
    - Is the product **"submerged" or nestled** among the background elements? (e.g. fruit/objects surrounding the product, wrapping around its base and sides, partially covering its edges, product sitting inside the pile rather than on top). Describe: do the background elements rise around the product, partially obscure it, create depth so the product looks integrated into the scene?
    - Summarize in one clear line: "Product pose: [lying down / standing upright / scattered / etc.]; Position: [inclined/tilted yes/no, direction]; Placement: [submerged/nestled among X / sitting on top of X / floating]." This will be copied into the final prompt.

5. **Generate a DETAILED Prompt** that recreates EVERY visual element:
    - EXACT composition and layout (where every element is positioned: person, product, text, buttons, etc.). Note whether the background/surrounding elements (e.g. fruits, objects, scenery) fill the entire frame edge to edge with the product centered (full-bleed, no blank margins) — describe this so it can be replicated.
    - EXACT colors (background, foreground, text, accents - specific shades, gradients, hex codes if visible)
    - EXACT typography (font styles, sizes, weights, exact text placement, alignment, effects like shadows/outlines) — describe so the same look can be replicated
    - EXACT background (style, colors, gradients, visual elements like silhouettes, blur effects, particles)
    - EXACT product/subject presentation: **position (inclined/tilted? angle/direction?), placement (submerged/nestled in the pile? fruit wrapping around base and sides?),** angles, lighting, shadows, number of products
    - EXACT person/character (if present: pose, expression, clothing, placement, interaction with product)
    - EXACT visual effects (lighting style, shadows, highlights, reflections, gradients, filters)
    - EXACT buttons/CTAs (if present: style, colors, typography, placement)
    - EXACT icon/feature rows (if present: horizontal row of small icons with 1–3 word labels — describe each icon shape/style and exact label text left-to-right)
    - EXACT overall aesthetic and mood

6. **Detect icon / feature badge rows (CRITICAL):**
    - Many ads have a **horizontal row of icons with short labels** (e.g. 4 items: leaf icon "NATURAL", diamond "PREMIUM QUALITY", shield "GENTLE & DURABLE", hexagon "Ag+" "SILVER-ION INFUSED").
    - If present: count items, describe icon style (thin line art, filled, metallic/gold), spacing, placement (above/below which text block, centered?), and **exact label text** for each item left-to-right.
    - If absent: say Present: no.

7. **Detect "Social proof" modules (CRITICAL):**
    - Determine if the ad contains a **customer review/testimonial block** (e.g. star rating row, reviewer name, quote bubble/card, "verified" badge, small-print review count, or "4.8/5 from 27,000+" style social proof).
    - If present, describe the **visual layout** of the review module (card shape, background color, border radius, placement), plus its content structure:
      - Star rating: how many stars shown, style (filled/outline), color.
      - Reviewer identity: name format (first name only? initials?), any "verified" checkmark/badge.
      - Review text: approximate length (short sentence vs multi-sentence), tone (hyped, casual, comedic), whether it includes profanity/bleeps like "f*ck".
      - Any numeric claims: rating (e.g. 4.8/5) or review count (e.g. 27,000+). These are product-specific and must NOT be copied during adaptation.
    - This will be used to recreate the same review module for a different product (with adapted content).

8. **Brand / logo placement in LAYOUT (CRITICAL — do not confuse with logo on product):**
    - **Standalone brand logo in layout:** Is there a brand logo or wordmark as its OWN design element in the ad (centered between text and product, corner badge, large emblem) — NOT counting logos printed on product packaging? (yes/no)
    - **Logo on product packaging only:** Does the brand logo appear ONLY on the product/pouch/box itself, with NO separate logo mark in the empty background/layout? (yes/no)
    - **Brand identity in layout type:** Choose exactly one: copy-only-text | logo-on-product-only | standalone-logo | standalone-and-product
      - copy-only-text: headlines/taglines only (e.g. "Pretty... and Practical") — NO logo graphic in layout
      - logo-on-product-only: logo on pouch/product only, layout is text + product
      - standalone-logo: separate logo mark in layout (in addition to or instead of heavy copy)
      - standalone-and-product: both standalone logo in layout AND logo on packaging
    - **Logo placement notes:** One sentence describing where brand identity lives (e.g. "Top headline text only; GOAT logo only on pink pouches, not in background").

The prompt must be so detailed that it would generate an IDENTICAL image to the reference ad.

Format your response EXACTLY as:
**TYPOGRAPHY (REFERENCE AD):**
- Font style/type: [e.g. bold sans-serif, display, serif — per tier if different]
- Headline visual size tier: [e.g. largest — dominant serif hook, ~2 lines max]
- Subheadline/sub-copy visual size tier: [e.g. clearly smaller — light sans, ~35–50% of headline cap height; NOT same size as headline even if many words]
- Text hierarchy ladder (top to bottom, list EVERY visible line): [e.g. 1) brand — small; 2) headline — largest; 3) subheadline — medium-small; 4) stars+reviews — smallest]
- Size ratio headline to sub: [e.g. subheadline ~40% of headline height / headline ~2.2× taller than sub]
- Text hierarchy notes: [one sentence: which line dominates; warn if sub is long but still subordinate visually]
- Weights: [e.g. bold headline, regular/light subheadline]
- Placement and alignment: [where text sits, alignment]
- Effects: [shadows, outlines, gradients on text, letter-spacing if visible]
(Describe everything needed to replicate the exact same typography AND size hierarchy in another ad.)

**TEXT LAYOUT (REFERENCE AD):**
- Text alignment: [center | left | right | mixed — how the top copy block is aligned]
- Stack direction: [vertical | horizontal | mixed — e.g. centered vertical stack: eyebrow → hero → subhero]
- Eyebrow line present: [yes/no — small caps product/category line above hero, e.g. "CHAMELEON LIP OIL"]
- Eyebrow style: [e.g. tiny all-caps sans, letter-spaced, ~10% of hero size]
- Hero headline style: [e.g. large high-contrast serif, 2 lines max, dominant]
- Subhero style: [e.g. light sans ~30% of hero height, single block under hero — NOT same size as hero]
- Layout notes: [one sentence: e.g. "Premium centered stack; subhero is much smaller than hero"]

**BEFORE / AFTER COMPARISON (REFERENCE AD):**
- Present: [yes/no]
- Layout type: [side-by-side equal panels | top-bottom | slider | single split — describe]
- Subject framing: [e.g. lip macro close-up | half face | full face | hair close-up | product only]
- Label style: [e.g. small italic serif "Before"/"After" in bottom corners]
- Panel transition: [soft gutter between panels | hard edge | blended — NOT weird face bisect]
- Placement in ad: [e.g. middle band between headline and product shot]
- Comparison notes: [lighting, realism, what makes it look natural vs uncanny]
(If no before/after module, write "Present: no".)

**LAYOUT ZONES (REFERENCE AD) — vertical band proportions (CRITICAL):**
- **Header/product band height:** [e.g. ~25-35% of frame — headline + product hero on gradient/sky]
- **Primary module height:** [e.g. ~65-75% of frame — before/after comparison, large hero, etc.]
- **Layout zone notes:** [one sentence: e.g. "Small top band with product bottle + copy; large bottom band is comparison module — NOT 50/50 split"]
(Do NOT default to equal halves unless reference is truly 50/50.)

**VISUAL STYLE (REFERENCE AD):**
- Has real photographic person/model: [yes/no]
- Has illustration/diagram/animation: [yes/no]
- Illustration/diagram type: [anatomical cutaway / flat illustration / 3d render / ingredient callout / stylized graphic / none]
- Visual medium: [photo | illustration | diagram | 3d-render | mixed | product-graphic-only]
- Has person/character: [yes/no — yes ONLY for real photos, NOT anatomical illustrations]
- Has gym, sport setting, or location environment: [yes/no]
- Main elements: [one-hero-only OR multiple]
- Retail packaging as separate element: [yes/no]
- Design type: [graphic-product-only | illustration-led | diagram-led | has-person | has-environment]
If illustration/diagram-led: the ad uses stylized graphics — NOT a real person photo. Adaptation must recreate illustration/diagram style with user's product, never default to stock lifestyle photography.
If "graphic-product-only" or "illustration-led": do NOT add real photographic people or gym/sport imagery.

**BRAND / LOGO PLACEMENT (REFERENCE AD):**
- Standalone brand logo in layout: [yes/no]
- Logo appears only on product packaging: [yes/no]
- Brand identity in layout type: [copy-only-text | logo-on-product-only | standalone-logo | standalone-and-product]
- Logo placement notes: [one sentence]

**COPYWRITING ANALYSIS:**
- Text Structure: [e.g. "Brand name + sub-tagline + headline (6 words) + spec line (8 words) + 4 icon labels" — ALL lines, word count per line]
- All text lines (top to bottom): [numbered list: role — exact text] (roles: eyebrow, brand-name, headline, subhero, spec-line, before-label, after-label, etc.)
- Headline/Tagline Word Count: [exact number of words in the first/short line, e.g. 3]
- Main Copy Word Count: [exact number of words in the main slogan/second line, e.g. 5]
- Word Count: [total or main line word count]
- Rhetorical Figure: [primary figure: metaphor/personification/hyperbole/analogy/slogan/motivational/aspirational/wordplay/sarcasm/other]
- Tone: [tone: e.g. playful, sarcastic, humorous, serious, professional]
- Style: [style category]
- **Function of Line 2 (CRITICAL):** What does the second line do? (e.g. benefit bridge "product helps you X", wordplay, punchline, transparency/craft, authority credential, spec list). Describe so adaptation replicates the SAME function — NOT a generic scrape dump.
- **Linguistic device of second line:** [wordplay / sarcasm / metaphor / joke / punchline / double meaning / straight benefit / benefit-bridge / authority / other]
- **Ad copy style:** [dtc-benefit-led | authority-led | spec-led | promo-led | other] — DTC = pain-point headline + emotional outcome subhero (common in Meta static ads)
- **Line 2 pattern:** [curiosity-gap | pain-agitation | product-helps-you | benefit-bullet-list | authority-credential | ingredient-spec | transparency-craft | wordplay | other] — use **curiosity-gap** when reference builds mystery (symptom story, "see the why", NO product name); **pain-agitation** when it agitates problem without revealing product; **product-helps-you** ONLY when reference literally names product + "helps you"
- **Product mentioned in reference copy:** [yes/no] — "no" if ad never names competitor product/brand in text (curiosity/problem ads)
- **Line 2 sentence template:** [abstract pattern — e.g. "You're [age/situation] and [symptom list]. But nobody told you why." for curiosity-gap; "[Product] helps you [benefit]" ONLY if reference used product-helps-you]
- **Promo / offer line in layout:** Does the reference have a SEPARATE line for sales/discounts (e.g. "30% OFF", "FLASH SALE", "FREE SHIPPING") distinct from the main headline? (yes/no). If no, adaptation must NOT add promo lines even if the product page has discounts.

**CREATIVE DECONSTRUCTION (CRITICAL — concept before pixels):**
Name the transferable idea underneath the ad — NOT a visual swap checklist.
- **Surface elements:** [layout format, color roles, UI modules, copy style — one sentence]
- **Emotional hook:** [tension, fear, desire, or aspiration being triggered — be specific]
- **Core concept:** [the transferable psychological idea that makes the ad work — NOT the competitor product name]
- **Resolution mechanism:** [how the product is positioned as the answer to the hook]
- **Target moment:** [when/where this tension happens — sleep, workout, morning routine, social context, etc.]

**MARKETING ANGLE (CRITICAL — read ALL copy + image together):**
- **Real topic:** [What is this ad ACTUALLY about? e.g. erectile dysfunction / low libido in men 30+, NOT "eggplant" or "vegetable". Read strikethroughs, headline, body, CTA as one story.]
- **Target audience:** [who feels the pain — age, gender, situation]
- **Core pain / tension:** [the emotional or physical problem being agitated]
- **Funnel stage:** [curiosity-gap | product-led | direct-offer | social-proof | other] — curiosity-gap = problem + mystery CTA, zero product reveal in copy
- **Product mentioned in copy:** [yes/no] — repeat from above; must match full text scan
- **Headline rhetorical role:** [e.g. one-word metaphor punch tied to visual ("Deflated"), contrarian hook, etc.]
- **Copy extrapolation notes:** [1–3 sentences: how an adapter should translate this SAME marketing angle to a different product category — e.g. keep mystery, swap symptoms to match new audience, never insert "[Product] helps you" if reference never did]

**VISUAL METAPHOR (CRITICAL — if hero is symbolic, not literal product):**
- **Present:** [yes/no]
- **Visual subject (literal):** [what you see — e.g. shriveled eggplant on white]
- **Symbolic meaning:** [what it REPRESENTS — e.g. deflated phallic virility / ED metaphor; be explicit if body/sexual innuendo, fitness failure, etc.]
- **Connection to headline:** [how image + headline work together — e.g. "Deflated" + wilted phallic shape]
- **Adaptation guidance:** [how to create an ANALOGOUS metaphor for a different product/audience — same symbolic idea, new object; e.g. flat deflated resistance band for weak strength, not random product packshot]
(If hero is literal product photography with no symbol, write Present: no.)

- **DO NOT COPY when adapting (product-specific data):** List any discount percentages (e.g. "64% OFF"), review numbers (e.g. "4.8/5 From 27,000+"), or other numerical claims in the reference. These must come ONLY from the scraped product page — never copy from reference.

**PROMO / OFFER LINE (REFERENCE AD):**
- Present: [yes/no]
- Exact text (if yes): [verbatim promo line only]
- Placement: [below headline / banner / corner — one phrase]
(If no promo line exists, write "Present: no".)

**TRUST BADGE / AWARD SEAL (REFERENCE AD):**
- Present: [yes/no]
- Description: [e.g. circular "Award Winner" press seal overlapping product]
- Placement: [e.g. bottom-right on center product, overlapping edge, scale ~15% of frame width]
(If absent, write "Present: no".)

**ICON / FEATURE ROW (REFERENCE AD):**
- Present: [yes/no]
- Item count: [N]
- Row layout: [centered horizontal row, spacing, position relative to headline and product]
- Icon style: [thin line art, filled, gold/metallic, relative size]
- Items left to right: [1) icon description — label "EXACT TEXT"; 2) ... list ALL]
(If not present, write "Present: no" and nothing else.)

**SOCIAL PROOF / REVIEW MODULE (REFERENCE AD):**
- Present: [yes/no]
- Visual layout: [describe the review card/bubble style, placement, colors, border radius, etc.]
- Stars: [present/absent, count shown, style, color]
- Reviewer name + badges: [name format, verified checkmark/badge yes/no, placement]
- Review text tone & length: [1 sentence / multi-sentence, hyped/casual/comedic, includes censored profanity like "f*ck" yes/no]
- Numeric claims in module (DO NOT COPY): [rating numbers, review count, discount numbers if any]
(If not present, write "Present: no" and nothing else.)

**PRODUCT UNITS (REFERENCE AD):**
- Visible unit count: [1–6 — count every distinct product unit/pack shown as a hero, e.g. three cans = 3]
- Same product repeated vs distinct variants: [same-repeated | distinct-variants] — distinct-variants when colors/flavors/labels differ (e.g. three different can colors); same-repeated when identical units
- Arrangement: [horizontal-row | scattered | stack | pyramid | other]
- Variant notes: [e.g. "three Huel cans in mint, peach, chocolate left to right" OR "three identical bottles"]
- Per-slot (optional, left to right): Slot 1: [color/flavor/label cue]; Slot 2: [...]; Slot 3: [...]
(If only one product hero, write Visible unit count: 1)

**PRODUCT POSE AND ARRANGEMENT (REFERENCE AD) — CRITICAL, OUTPUT THIS BLOCK:**
Write ONE detailed paragraph that describes how the product(s) should be positioned. **PREFER arrangements that look best in ads:** When the reference shows multiple bottles/products in a pyramid or triangle stack, describe them instead as **in a horizontal row** (side by side) — a row looks cleaner and more professional than a triangle. Only use pyramid/triangle if the reference has a strong, intentional reason for it. Include:
- Number of product units visible (e.g. three bottles, four earplugs).
- **Arrangement:** Prefer "in a row", "side by side", "horizontal line" over pyramid/triangle. E.g. "Three bottles arranged in a horizontal row, side by side" not "stacked in a pyramid".
- Pose: lying down flat / standing upright / on their side. Orientation of parts.
- Overlap and angles if applicable.
- Surface and lighting: on a flat surface, soft shadows beneath.
Write it so the image model renders the user's product in this layout. Example: "Three bottles in a horizontal row, side by side on a white surface, slight diagonal from left to right. Soft shadows beneath. No pyramid or triangle stack — a clean row."

**REFERENCE AD PROMPT:**
[Generate a COMPREHENSIVE, EXTREMELY DETAILED prompt that would recreate this exact static ad. Include ALL visual elements: composition, colors, typography with exact text placement and EVERY text line verbatim, icon/feature rows with each icon and label, background, product presentation (especially: **product pose** — lying down / standing upright / scattered / on its side and exact angles; **product position** — inclined/tilted and direction; **product placement** — submerged/nestled among fruits or objects, with those elements wrapping around the product's base and sides, partially obscuring edges; lighting, shadows, reflections), person/character (if present), effects, buttons (if present). The prompt should be ready to use in an AI image generator and would produce an identical image.]`;
}

function productUseCaseAdaptationBlock(ctx: AdaptationContext): string {
  if (ctx.hasPersonInReference) {
    return `**CRITICAL — AUTHENTIC PRODUCT USE (do not copy the competitor product literally):**
The reference shows a person with the **competitor's** product. Your ad must show a person with the **user's** product from the provided image — in how that product is **actually used**, not by morphing it into the competitor's interaction.

**Keep from reference:** number of people, shot type (portrait / lifestyle / close-up), camera framing, mood, lighting quality, color palette, text layout, premium aesthetic.

**Derive from the user's product:** real use case — bedding on bed/pillow, skincare applied or held near face, apparel worn, supplement in hand, gym/fitness for sports nutrition, etc.
- **Do NOT** force the user's product into the competitor's pose when it is physically wrong (pillowcase as head wrap, protein tub as phone, etc.).
- **Do NOT** keep the competitor's setting (bedroom for sheets) when the user's product belongs to a different category (creatine → gym/fitness setting with same aesthetic quality).
- **DO** show the user's product clearly and believably in scene with a model interaction that matches the product category.
- If reference and user product are the **same category** (both wearable accessories, both held in hand): you may keep similar grip/placement.

**Examples:** Reference model wearing silk head wrap + user sells silk pillowcase → model in soft bedroom/beauty shot with head resting on or beside the pillowcase, product as bedding; NOT wearing the pillowcase on the head. Reference bedroom still-life + user sells creatine → gym/fitness environment with same soft editorial light, NOT the bed.

${productPlacementOnModelBlock(ctx)}`;
  }

  if (ctx.isGraphicOnly && !ctx.hasIllustrativeVisual) {
    return '';
  }

  return `**CRITICAL — AUTHENTIC PRODUCT CONTEXT (environment & props — every ad):**
The reference may show the **competitor's** category setting (bedroom, kitchen, coffee bar, etc.). Your ad must place the user's product in a setting that is **100% on-theme for their product category**, while keeping reference layout, composition, and aesthetic quality.

**Keep from reference:** layout zones, text placement, camera angle, lighting mood, color grading style, premium/editorial feel, product placement zones.
**Derive from user's product:** correct environment, surfaces, and props — gym/studio for creatine & sports nutrition, bedroom for bedding, vanity for skincare, etc.
**Do NOT** keep competitor props (bedsheets, coffee cups, competitor lifestyle) when the user's product belongs to a different category.`;
}

function peopleModelsCriticalBlock(ctx: AdaptationContext): string {
  if (!ctx.hasPersonInReference) return '';
  return `**CRITICAL — KEEP PEOPLE / MODELS (reference shows humans):**
The reference ad includes one or more **people** using or featuring a product. You MUST **preserve the human presence** in the final ad:
- **Do NOT remove people** and do NOT turn the ad into a **product-only** shot unless the user explicitly requests that in Guidelines.
- **Do NOT drop** the reference's shot type (portrait, lifestyle, close-up) — keep the same **framing and visual grammar**.
- **Product interaction is dynamic:** Show the **user's product** in its **authentic use case** (see AUTHENTIC PRODUCT USE above). Clone composition and mood; **do not** clone the competitor's product form (worn on head, wrong grip) when the user's product is used differently.
- **Avatars / appearance:** You MAY vary faces, hair, skin tone, age for diversity; keep the same **shot energy** and product visibility.
- **Setting:** Shift setting to fit the **user's product category** (gym for creatine, bedroom for bedding, vanity for skincare) while matching the reference's **production quality, lighting mood, and aesthetic**. Do NOT keep competitor-category environments when categories differ.
`;
}

function oneHeroBlock(ctx: AdaptationContext): string {
  if (!ctx.enforceOneMainElement) return '';
  return `**CRITICAL — ONE MAIN ELEMENT ONLY (no packaging):**
The reference ad has only ONE main visual hero (e.g. one cookie, one food item).${ctx.guidelinesAskSingleHero ? ' The user\'s Guidelines also specify a single main element (e.g. "gummy as the main element").' : ''}${ctx.hasPersonInReference ? ' **Exception:** If the reference also shows people, do NOT remove the people to satisfy "one hero" — this rule applies to product item vs packaging (e.g. one gummy vs pouch), not to removing models.' : ''} Your prompt MUST describe only that ONE hero as the focal subject — do NOT include product packaging, pouch, bag, or a second product in the scene. The main element is the product item itself (e.g. the gummy, the cookie) as the user requested or as the reference shows — not the packaging. If the product image shows packaging, ignore it for the hero; use only the single main element (e.g. the gummy itself) so the ad matches the reference's one-hero composition.
`;
}

function graphicOnlyBlock(ctx: AdaptationContext): string {
  if (ctx.hasIllustrativeVisual) {
    return illustrativeVisualBlock(ctx);
  }
  if (!ctx.isGraphicOnly) {
    if (ctx.hasPersonInReference) {
      return `**Person/Environment (reference has people):** **Priority: keep people + same shot type/framing.** Show the user's product in **authentic use** — adapt pose/setting when the competitor's product interaction or environment does not fit (see AUTHENTIC PRODUCT USE). Optional: refresh avatar diversity.`;
    }
    return `**Environment (reference has setting):** Adapt the setting and props to the **user's product category** while keeping reference layout and aesthetic quality (see PRODUCT-THEMED ENVIRONMENT).`;
  }
  return `**REFERENCE AD IS GRAPHIC/PRODUCT-ONLY:**
The reference uses product + background/graphics (no people). Keep the same graphic style and layout — but **swap props and background motifs** to match the user's product category (see PRODUCT-THEMED ENVIRONMENT). Do NOT add people unless Guidelines request it.`;
}

function analyzeProductContextBlock(ctx: AdaptationContext): string {
  const { isGraphicOnly, hasPersonInReference } = ctx;
  if (isGraphicOnly) {
    return `1. **Analyze Product Context (CRITICAL):**
   - Analyze the product image to understand: product type, category, purpose, target audience, industry
   - Keep the ad GRAPHIC: product + background/graphics only. Do NOT add people unless Guidelines request it.
   - **Swap graphic props/motifs** to the user's product category while keeping the same visual medium and layout structure
   - Always maintain the EXACT same design structure, composition, and layout from reference
   - Keep all visual design principles, effects, and aesthetics consistent`;
  }
  if (hasPersonInReference) {
    return `1. **Analyze Product Context (CRITICAL):**
   - Analyze the product image to understand: product type, category, purpose, target audience, industry, and **how it is actually used** (worn, held, applied, slept on, placed in room, etc.)
   - **People preserved (reference has models):** Keep the **same number of people** and **same shot type/framing** (portrait, lifestyle, close-up). Show the **user's product in authentic use** — NOT a literal copy of the competitor's interaction when categories differ (e.g. head wrap → pillowcase = bedding/sleep context, not turban).
     * **Adapt pose and scene** to match the user's product use while preserving reference **composition, mood, and ad layout**.
     * Do **not** remove models or switch to product-only unless Guidelines require it.
   - Always maintain the EXACT same design structure, composition, and layout from reference (text zones, full-bleed, hierarchy)
   - Setting must shift to the **user's product category** when it differs from the reference (gym for creatine, bedroom for bedding, etc.) — keep the same production quality and aesthetic as the reference
   - Keep all visual design principles, effects, and aesthetics consistent`;
  }
  return `1. **Analyze Product Context (CRITICAL):**
   - Analyze the product image to understand: product type, category, purpose, target audience, industry
   - **Environment adaptation (mandatory):** Replace reference setting/props with a scene **100% on-theme for the user's product** (e.g. creatine → aesthetic gym/fitness studio with soft editorial light, NOT the reference competitor's bedroom/kitchen)
   - Always maintain the EXACT same design structure, composition, and layout from reference
   - Adapt contextual elements (background setting, surfaces, props, styling) to match the product category — preserve reference lighting mood and premium aesthetic
   - Keep all visual design principles, effects, and aesthetics consistent`;
}

function maintainDesignElementsBlock(ctx: AdaptationContext): string {
  const { hasPersonInReference, isGraphicOnly, referenceProductPoseAndArrangement } = ctx;
  const poseNote = referenceProductPoseAndArrangement
    ? ' **in relation to the model(s)** (e.g. held in hand, near face)'
    : '';
  return `2. **Maintain ALL design elements** from the reference prompt:
   - Keep the EXACT same composition structure
   ${hasPersonInReference ? `- **People + product (CRITICAL):** The reference is a **people + product** shot. Explicitly describe **each person** with the **user's product in authentic use** (natural interaction for that product category). Match reference **framing and mood**; do NOT copy the competitor's wrong interaction (e.g. wearing bedding on the head). Do not omit human figures from the prompt.` : ''}
   - **Product POSE AND ARRANGEMENT (CRITICAL — you MUST use the block above):**${hasPersonInReference ? ` For **lifestyle / model-in-use** references: treat the pose block as describing the **competitor's** placement for context only — in your final prompt, translate to the **user's product authentic use** (same shot energy, correct interaction).` : ''} The reference ad has a specific product pose, order, and arrangement${poseNote} (e.g. lying horizontally, tips out, bases in, two pairs clustered, soft shadows). You MUST describe the user's product in an arrangement that fits the reference **layout**${hasPersonInReference ? ' and believable model interaction' : ''} — use the "PRODUCT POSE AND ARRANGEMENT" block when it applies to flat/product-row shots; for in-use lifestyle shots, prioritize authentic use over copying competitor wear/placement. Do NOT describe the product only as in the flat upload if the ad needs a composed lifestyle scene.
   - **Product position and placement (CRITICAL — replicate exactly):** Identify in the reference ad how the product is positioned (inclined/tilted? which direction/angle?) and how it is placed relative to the background (e.g. submerged/nestled among fruit, with fruit wrapping around its base and sides, partially covering edges; or sitting on top). Your prompt MUST describe the SAME for the new product: same inclination/tilt and direction, same "submerged/nestled" relationship — background elements (fruits, objects) must surround the product, rise around its base and sides, partially obscure it where the reference does, so the product looks integrated into the scene, not floating or simply on top of a flat layer.
   - **Composition and framing (CRITICAL — match reference):** In the reference ad, background elements (e.g. fruits, objects, textures, scenery) fill the ENTIRE frame edge to edge; the product is centered. There are NO blank margins or empty white space around the edges. Your prompt MUST describe this: background and decorative elements must extend to all sides and fill the frame completely; full-bleed composition; no empty borders or white space.
   - Keep the EXACT same layout and positioning of all elements
   - Keep the EXACT same visual effects (lighting style, shadows, effects)
   ${isGraphicOnly ? '- Keep the ad GRAPHIC (no people unless Guidelines request). Swap background props/motifs to user product category — see PRODUCT-THEMED ENVIRONMENT.' : hasPersonInReference ? '- **Person/Character:** **Keep the people.** Same count, same framing in frame. **Adapt interaction** so the user\'s product is used authentically (not a literal copy of competitor wear/hold when wrong). You may vary appearance for diversity (avatars) but **not** remove people or replace with product-only mockup.' : '- **Environment:** Replace reference setting/props with user product category scene while keeping reference layout, lighting mood, and aesthetic quality.'}
   - Keep the EXACT same buttons/CTAs design and placement (if applicable)
   - **Typography:** COPY reference font styles, weights, placement, effects — AND the **size ladder** (headline largest; subheadline/supporting copy clearly smaller; footer smallest). Never render subheadline at nearly the same size as the headline.`;
}

function replaceAdaptProductBlock(ctx: AdaptationContext): string {
  const { isGraphicOnly, hasPersonInReference, enforceOneMainElement } = ctx;
  const header = isGraphicOnly
    ? '4. **Replace/Adapt product references:**'
    : hasPersonInReference
      ? '4. **Replace/Adapt product references (keep people; authentic product-in-use):**'
      : '4. **Replace/Adapt product references AND adapt people/actions to match product context (CRITICAL):**';

  let peopleBlock = '';
  if (isGraphicOnly) {
    peopleBlock =
      '- Keep the ad graphic: product(s) + category-themed background/graphics. No people unless Guidelines request. Props must match user product category.';
  } else if (hasPersonInReference) {
    peopleBlock = `- **PEOPLE STAY — AUTHENTIC PRODUCT-IN-USE (CRITICAL):**
     * **Do not remove** people or convert to product-only layout.
     * Show the **same number of people** with the **same shot type and framing** as the reference.
     * The **user's product** must appear in its **real use case** — analyze the product image and category first. **Do not** copy the competitor's interaction when it misrepresents the user's product (worn on head, wrong grip, wrong context).
     * **Adapt pose, hands, and setting** so the scene is believable (bedding in bedroom, skincare at vanity, apparel worn correctly). Keep reference **mood, lighting, and ad layout**.
     * Optional: **new avatars** (faces, hair, skin tone) for diversity.
   - If reference shows person with product on body: re-stage for the **user's product** (e.g. pillowcase on bed with model resting, not wrapped on head unless it is headwear).
   - If reference shows hand holding product and user's product is also handheld: similar grip and angle is OK.`;
  } else {
    peopleBlock = `- **ADAPT PEOPLE AND ACTIONS TO MATCH PRODUCT CONTEXT:**
     * If product is fitness/sports (e.g., creatine, protein): show person in gym/sports setting, working out, athletic clothing and active pose
     * If product is beauty/cosmetics: show person in beauty context, applying product or beauty-focused pose
     * If product is tech/gadgets: show person using product in tech context
     * **CRITICAL**: Adapt the person's pose, expression, clothing, setting, and action to the NEW product's actual use case.
   - If reference shows person holding product: adapt to show person using NEW product in contextually appropriate way
   - Adapt ALL visual context (background, setting, person styling, person actions/pose) to match the NEW product's actual use case and category`;
  }

  return `${header}
   - Analyze the product image: type, category, purpose, colors, branding, shape, characteristics
   ${ctx.referenceShowsPackaging ? `- **PACKAGING SLOT (MANDATORY):** Reference had a packaging zone — place the user's catalog packaging photo in the same position. Use THEIR container (pouch/bag/box) — NEVER copy reference bottle/jar shape.` : ''}
   ${enforceOneMainElement ? `- **ONE MAIN ELEMENT ONLY:** The reference has one hero (e.g. one cookie). Show ONLY that one element for the new product — e.g. the gummy itself as the hero, NOT the product packaging or pouch. Do not describe or include packaging in the scene; the single focal subject is the product item (the gummy, the cookie, etc.) only.${hasPersonInReference ? ' **Still keep any people** from the reference — this rule is about item vs packaging, not removing models.' : ''}` : ''}
   - Replace product descriptions with the NEW product from the provided image
   - **Product presentation (CRITICAL — catalog photos are source of truth):** The USER'S product must look EXACTLY as in the provided catalog images — same container type (pouch vs bottle vs gummies), labels, logo, shape. Replicate reference **layout zones and pose** only — NEVER copy reference competitor product form (e.g. do NOT draw a pill bottle when catalog shows gummy pouch). (1) **Pose:** same orientation as reference for the user's actual product form; (2) **Position:** same inclination/tilt and direction; (3) **Placement:** same submerged/nestled relationship with background elements; (4) shadows, lighting, reflections as reference.
   ${peopleBlock}
   - If reference shows multiple products: show multiple instances of NEW product in SAME arrangement
   - Maintain same angles, lighting, shadows as reference but for NEW product (product design unchanged; presentation adapted)`;
}

function outputRequirementsBlock(ctx: AdaptationContext): string {
  const {
    hasPersonInReference,
    isGraphicOnly,
    enforceOneMainElement,
    hasReferenceReviewModule,
    scrapedBranding,
    headlineWords,
    mainCopyWords,
  } = ctx;

  return `**Output:**
Provide ONLY the final, complete, EXTREMELY DETAILED prompt ready for AI image generation. The prompt should:
- Maintain ALL visual design elements from the reference prompt (composition, layout, typography placement, background style, effects)
- **Full-bleed composition (CRITICAL):** Describe the scene so that background and surrounding elements (e.g. fruits, objects, textures, scenery${hasPersonInReference ? ', people' : ''}) fill the ENTIRE image edge to edge like the reference${hasPersonInReference ? '; people-based shots may center on models + product, not only a lone product' : '; the product is centered where the reference centers it'}. There must be NO blank or white margins — the composition must be full-bleed like the reference ad, with elements reaching all sides of the frame.
- **Product pose, position and placement (CRITICAL):**${hasPersonInReference ? ' For lifestyle/model shots: describe the user\'s product in **authentic use** with the same shot framing as the reference — do NOT copy competitor wear/placement when wrong for the new product. For flat product-row references: use the PRODUCT POSE block.' : ''} Include product pose/arrangement from the "PRODUCT POSE AND ARRANGEMENT" block when it describes layout (row, angles, shadows) — adapted for "the product from the provided image". Product design (colors, branding, shape) comes from the provided image${hasPersonInReference ? '; interaction and scene come from the user\'s real use case' : '; pose and arrangement come from the reference block'}.
${scrapedBranding ? "- Where the reference ad shows brand name or logo, specify that the product's brand logo (from the scraped page) appears in the same position and style for a personalized look." : ''}
- **Copy length and phrasing:** Use the **Approved copy** block verbatim — **each text line exactly once**, in order. NEVER repeat strikethrough dismissals, headline, or body. Total visible lines = approved count. Tagline ≤ ${headlineWords} words; main secondary ≤ ${mainCopyWords} words. Same tone as reference; clear, conversion-ready copy. **The second line must fulfill the SAME function as the reference** (wordplay, punchline, sarcasm, metaphor) — never use generic product specs as main copy unless the reference does. Grammatically correct. Never one long sentence as the headline.
- **Typography hierarchy (CRITICAL):** In the image description, specify **relative font sizes per line** — headline visually dominant; subhero clearly smaller (~28–38% of headline height, light/regular weight only) even when it has more words; footer/reviews smallest. FAIL if subhero competes with headline size.
${ctx.hasReferenceFeatureRow ? '- **Icon/feature row:** Include the full icon row with same count, style, and placement as reference; use approved icon labels.' : ''}
- **Promo lines:** ${ctx.referenceHasPromoOfferLine ? 'Only if approved copy includes promo claims from scrape.' : 'Reference had no promo line — final image must NOT include sale/discount/flash-offer text.'}
- **Original headlines:** No verbatim reuse of reference competitor hooks${ctx.referenceVerbatimPhrases.length ? ` (${ctx.referenceVerbatimPhrases.join('; ')})` : ''}.
- **Trust badge:** ${ctx.referenceTrustBadge.present ? 'Include award/press seal overlapping product as in reference, using user trust_badge image if provided.' : 'Only if reference had one.'}
- **Composition:** Balanced hierarchy — headline zone, comparison/table or hero product zone, product row with depth/shadows; seal overlaps product edge; no cramped text; full-bleed background.
- **STRICT DATA:** Product facts from scrape/approved copy only. Never invent claims or copy competitor numbers from reference.
${hasReferenceReviewModule ? `- **Review module present:** Include the review/testimonial/social-proof module in the final image description, matching the reference's visual placement/style. Adapt the testimonial to the user's product. Do not invent numeric rating/review counts unless present in scraped data.` : ''}
${ctx.referenceShowsPackaging ? '- **Packaging in layout:** User catalog packaging in reference zone — NEVER reference competitor bottle shape or wrong container type.' : ''}
${enforceOneMainElement ? '- **One main element only:** The scene must have ONE hero (e.g. the gummy or product item only). Do NOT describe product packaging, pouch, or a second element in the image.' : ''}
- **PRODUCT CATALOG FIDELITY:** Final image must show ONLY the user product from provided catalog photos — never the reference competitor product or a reskinned reference bottle.
${isGraphicOnly ? '- Keep the ad GRAPHIC (no people unless Guidelines). Background props must match user product category — same aesthetic quality as reference.' : hasPersonInReference ? "- **Keep people in the scene.** Same framing/composition as reference; user's product shown in **authentic use** with on-theme setting (not literal competitor environment when categories differ)." : '- **Environment:** Setting, surfaces, and props must be 100% on-theme for user product category while keeping reference layout and aesthetic (e.g. creatine → aesthetic gym, not reference bedroom).'}
- Feature the NEW product from the provided image in contextually appropriate use
${scrapedBranding ? '- Integrate product brand colors and typography where appropriate' : ''}
- Be ready to use with Kie.ai image generation (Nano Banana Pro for design ads, GPT Image 2 for realistic ads)
- Do NOT include explanations, analysis, or additional text - ONLY the final detailed prompt`;
}

export type FinalPromptOptions = {
  /** Agente: copy ya aprobado por copy agent */
  approvedCopy?: CopyAdaptationResult;
  /** Agente: notas visuales del visual agent */
  visual?: VisualAdaptationResult;
  /** Texto extra (QA retry, etc.) */
  extraBlocks?: string;
  /** Prefijo (ej. rol del modelo) */
  preamble?: string;
};

/**
 * Step 2 — finalPromptGeneration de oldprompts.md (completo).
 */
export function buildFinalPromptGeneration(
  ctx: AdaptationContext,
  options: FinalPromptOptions = {}
): string {
  const {
    referencePrompt,
    referenceTypography,
    referenceProductPoseAndArrangement,
    reviewModuleInstructions,
    isUrlScraped,
    scrapedSummary,
    scrapedBranding,
    brandingIntegration,
    copywritingInstructions,
    guidelinesTrimmed,
    hasPersonInReference,
  } = ctx;

  const poseBlock = referenceProductPoseAndArrangement
    ? `
**PRODUCT POSE AND ARRANGEMENT (MANDATORY — do not skip):**
${hasPersonInReference ? `**NOTE — Reference includes people (models):** This block describes the **competitor's** product placement. Keep the same **number of models and shot framing**; show the **user's product in authentic use** — do NOT copy competitor interaction when it misrepresents the new product (e.g. head wrap → pillowcase = bedding/sleep, not worn on head).
` : ''}The reference ad shows the product in a specific pose and arrangement. The image generator will use your description to COMPOSE the scene${hasPersonInReference ? '; for lifestyle shots, prioritize authentic product-in-use over copying competitor wear/placement' : ''}. If you describe the product as only the flat upload with no composed scene, the result will be wrong.
You MUST include product placement in your final prompt. Describe the USER'S product (from the provided image)${hasPersonInReference ? ' in believable use with the model(s), matching reference framing' : ' in THIS exact pose and arrangement — not only as in the flat upload'}:
---
${referenceProductPoseAndArrangement}
---
Adapt only the product name: write "the product from the provided image" or "the user's [product type] from the provided image" so the design/color/branding come from the image but the POSE, ORDER, ANGLE and ARRANGEMENT come from this block. **Prefer "in a row" / "side by side" over pyramid/triangle stacks** — a row looks cleaner. Your final prompt must contain a paragraph or bullet list that replicates this pose/arrangement for the user's product.`
    : '';

  const typographyBlock = referenceTypography
    ? `
**Typography from Reference Ad (COPY style + hierarchy into the final prompt):**
${referenceTypography}
You MUST replicate the same typography style, font appearance, **relative sizes per line**, weights, placement and text effects from the reference ad in your output.`
    : '';

  const typographyHierarchySection = typographyHierarchyBlock(ctx);

  const approvedCopyBlock = options.approvedCopy
    ? `\n${formatApprovedCopyBlock(options.approvedCopy, ctx.copywritingProfile, ctx.referenceTextLayout)}\n`
    : '';

  const visualBlock = options.visual
    ? `
**Visual adaptation (from product image analysis):**
- Product: ${options.visual.productType} — ${options.visual.productDescription}
- Pose/arrangement: ${options.visual.poseAndArrangementParagraph}
- People/scene: ${options.visual.peopleAndSceneRules}
- Composition: ${options.visual.compositionRules}
- Branding: ${options.visual.brandingNotes}
${options.visual.iconRowNotes ? `- Icon row: ${options.visual.iconRowNotes}` : ''}
${options.visual.trustBadgeNotes ? `- Trust badge: ${options.visual.trustBadgeNotes}` : ''}`
    : '';

  return `${options.preamble ?? 'You are a senior direct-response creative director writing image-generation prompts (Kie.ai). Rebuild the reference **concept** natively for the user product — not a visual swap.'}

You have been given:

1. A DETAILED prompt that recreates the reference static ad design
2. An image of a NEW product that needs to replace the product in the reference ad
${isUrlScraped && scrapedSummary ? '3. Scraped product page information (summary and branding)' : ''}

**Reference Ad Prompt (use this as the base structure - maintain ALL design elements):**
${referencePrompt}
${typographyBlock}
${typographyHierarchySection}
${textLayoutBlock(ctx)}
${beforeAfterComparisonBlock(ctx)}
${poseBlock}
${reviewModuleInstructions ? `\n${reviewModuleInstructions}` : ''}
${featureRowInstructionsBlock(ctx)}
${approvedCopyBlock}
${visualBlock}

${logoPlacementRulesBlock(ctx)}
${creativeBridgeBlock(ctx.creativeBridge)}
${productCreativeProfileBlock(ctx)}
${ctx.copyLanguageInstruction}
${ctx.pricingInstructions}

**REFERENCE PROMPT WARNING:** The reference block above may contain competitor prices (e.g. "$79 NOW"). IGNORE all dollar amounts from the reference. Follow PRICING rules above only.

**Your Task:**
Adapt the reference prompt above to create a NEW prompt for the product in the provided image. The new prompt must:

${peopleModelsCriticalBlock(ctx)}${productUseCaseAdaptationBlock(ctx)}${oneHeroBlock(ctx)}${productCatalogFidelityBlock(ctx)}${productThemedEnvironmentBlock(ctx)}${packagingMirroringBlock(ctx)}${graphicOnlyBlock(ctx)}

${illustrativeVisualBlock(ctx)}

${beforeAfterComparisonBlock(ctx)}

${noStockPhotoUnlessReferenceBlock(ctx)}

${analyzeProductContextBlock(ctx)}

${maintainDesignElementsBlock(ctx)}

3. **Adapt Colors and Typography:**
${backgroundColorAdaptationBlock(ctx)}
${scrapedBranding ? brandingIntegration : '- Use product brand colors for background; keep reference layout color roles'}
${scrapedBranding ? '- Integrate product brand colors from branding data for backgrounds, gradients, accent bars, and highlights' : ''}
${scrapedBranding ? '- Prefer REFERENCE AD typography hierarchy; use product brand typography only for small product labels if needed' : ''}
- **Always preserve the reference ad typography** (font style, **relative sizes per line**, weights, placement, effects) so the new ad looks like the reference.
${typographyHierarchySection}
- Do NOT copy competitor category background colors (coffee brown, etc.) — use user product branding hues with same mood/role as reference
- Use brand colors strategically for product elements, backgrounds, and accents

${replaceAdaptProductBlock(ctx)}

5. **STRICT DATA RULE — Match reference STRUCTURE; scraped data fills allowed slots only:**
- **Promo/offer lines:** ${ctx.referenceHasPromoOfferLine ? 'Reference HAS a promo line — you may use scraped discount/offer text in that slot only (exact numbers from scrape).' : 'Reference has NO promo line — do NOT add "FLASH SALE", "% OFF", checkout offers, or any sale banner even if the product page mentions them.'}
- **Original copy:** Never reuse reference headline/hook phrases verbatim${ctx.referenceVerbatimPhrases.length ? ` (forbidden: ${ctx.referenceVerbatimPhrases.map((p) => `"${p}"`).join(', ')})` : ''}. Same rhetorical pattern, new words for the user's product.
- **When scraped data has benefits/specs** — use them in spec lines, icon labels, footers. Do NOT invent claims.
- **When scraped data does NOT have a fact** — omit. Never copy competitor copy or numbers from the reference.

6. **Create Copywriting (SAME TONE + CLEAR, PERFECT COPY — CRITICAL):**
${marketingAngleExtrapolationBlock(ctx)}
${referenceCopyMirroringBlock(ctx)}
${textLayoutBlock(ctx)}
${subheroCopyPatternBlock(ctx)}
${beforeAfterComparisonBlock(ctx)}
${copywritingInstructions}
**The reference ad has SHORT text.** Match its tone and style exactly, but every phrase MUST be clear, understandable, and effective copywriting — no confusing or vague wordplay (e.g. avoid "GUMMIES YOU CAN BUILD WITH A POP" which is unclear; use clear lines like "TASTES LIKE BERRY", "BOOST YOUR STRENGTH", "5G CREATINE ZERO SUGAR"). Same brevity: short tagline (${ctx.headlineWords} words or fewer) and short main line (${ctx.mainCopyWords} words or fewer). Grammatically correct and natural. The copy must be immediately understandable and conversion-ready while keeping the reference's tone, rhetorical figure, and style. Do NOT describe one long headline. Describe all short lines that match the reference text architecture (brand, headline, spec line, icon labels). **REMEMBER: ALL promotional text (FREE GIFTS, BIG DISCOUNTS, discount %, review numbers, etc.) must come STRICTLY from scraped data. If not in scraped data, omit. Never invent or copy from the reference.**
${ctx.trustBadgeInstructions ? `\n${ctx.trustBadgeInstructions}\n` : ''}
${options.approvedCopy ? '**Use the Approved copy block above verbatim** — do not rewrite or simplify it.' : ''}
${guidelinesTrimmed ? `
7. **Guidelines from the user (apply these changes):**
${guidelinesTrimmed}
You MUST take these instructions into account when generating the final prompt.` : ''}

${options.extraBlocks ?? ''}

${outputRequirementsBlock(ctx)}`;
}

/** Copy agent — sección 6 de finalPromptGeneration + estructura de texto */
export function buildCopyAgentInstructions(ctx: AdaptationContext): string {
  return `${marketingAngleExtrapolationBlock(ctx)}

${referenceCopyMirroringBlock(ctx)}

${ctx.copywritingInstructions}

**The reference ad has SHORT text (oldprompts finalPromptGeneration §6).** Match tone and style; every phrase clear and conversion-ready. Same brevity per line. Do NOT collapse multi-line layouts to 2 lines. Line 2 must fulfill the SAME rhetorical function as reference (wordplay/punchline/transparency/spec — match reference device, NOT generic authority claims or unrelated spec dumps). **Never copy reference headline wording verbatim** — mirror structure with new words for the user's product. Promo claims only if reference had a promo line AND scrape supports them; otherwise promoClaimsUsed must be empty.

**Text structure:** ${ctx.copywritingProfile?.textStructure ?? 'mirror every visible line from reference'}
**Function of line 2:** ${ctx.copywritingProfile?.functionOfLine2 ?? 'match reference'}
**Device:** ${ctx.copywritingProfile?.linguisticDeviceLine2 ?? 'match reference'}
**Line 2 pattern:** ${ctx.line2Pattern}`;
}

/** Visual agent — secciones 2 y 4 de finalPromptGeneration */
export function buildVisualAgentInstructions(ctx: AdaptationContext): string {
  return `${visualMetaphorExtrapolationBlock(ctx)}

${marketingAngleExtrapolationBlock(ctx)}

${layoutProportionsBlock(ctx)}

${textLayoutBlock(ctx)}

${beforeAfterComparisonBlock(ctx)}

${illustrativeVisualBlock(ctx)}

${noStockPhotoUnlessReferenceBlock(ctx)}

${packagingMirroringBlock(ctx)}

${backgroundColorAdaptationBlock(ctx)}

${productThemedEnvironmentBlock(ctx)}

${productUseCaseAdaptationBlock(ctx)}

${maintainDesignElementsBlock(ctx)}

${replaceAdaptProductBlock(ctx)}`;
}
