/**
 * Prompts canónicos de oldprompts.md — Step 1 (análisis) y Step 2 (finalPromptGeneration).
 * Usados por: generate-static-ad-prompt (Step 1), agente de adaptación, legacy Step 2.
 */
import type { AdaptationContext, CopyAdaptationResult, VisualAdaptationResult } from './types';
import { logoPlacementRulesBlock } from './logo-rules';

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

export function formatApprovedCopyBlock(copy: CopyAdaptationResult): string {
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

  return `**Approved copy — use EXACTLY this visible text in the ad:**
${lines}
${copy.brandName ? `- Brand name: "${copy.brandName}"` : ''}
${copy.brandSubtagline ? `- Brand sub-tagline: "${copy.brandSubtagline}"` : ''}
${copy.specLine ? `- Spec/credentials line: "${copy.specLine}"` : ''}
${copy.reviewText ? `- Review/testimonial: "${copy.reviewText}"` : ''}
${copy.reviewNumericClaims ? `- Review numbers (scrape only): "${copy.reviewNumericClaims}"` : ''}
${icons}`;
}

/** Step 1 — staticAdAnalysisPrompt (+ detección iconos y logo en layout) */
export function getStaticAdAnalysisPrompt(): string {
  return `You are an expert prompt engineer for AI image generation. Analyze the provided static ad image and generate a COMPREHENSIVE, DETAILED prompt that would recreate this EXACT image.

Your task:

1. **Identify Copywriting Characteristics and BREVITY** (for later adaptation):
    - **Text structure**: Count EVERY visible text element top-to-bottom (brand name, brand sub-tagline, headline, spec/credentials line, CTA, icon labels, etc.) — NOT just two lines. Example: "Brand SILUXE + sub-tagline + serif headline + sans spec line + 4 icon labels". Count words PER LINE separately.
    - **All text lines (top to bottom):** List each line with its exact reference text and role (brand-name, brand-subtagline, headline, spec-line, icon-label, cta, etc.).
    - Count the EXACT number of words in the main headline/tagline (first line) and in the main copy/slogan (second line or main block) separately.
    - Identify the rhetorical figure used (metaphor, personification, hyperbole, analogy, slogan, motivational, aspirational, etc.)
    - Note the tone (friendly, professional, playful, serious, etc.)
    - Note the style category (corto y persuasivo, humor, irónico, directo, emocional, etc.)

2. **Extract Typography from Reference Ad (CRITICAL for replication):**
    - Describe the typography in a dedicated section: font style/type (e.g. sans-serif bold, serif, display, script), approximate sizes (headline vs body), weights (light, regular, bold, black), text placement (top, center, overlay), alignment (left, center, right), and any effects (shadows, outlines, gradients on text, letter-spacing). This will be used to COPY the same typography in the final ad.

3. **Identify VISUAL STYLE / DESIGN TYPE** (CRITICAL — do not add people or gym if reference has none):
    - Does the reference ad show ANY person, athlete, or human? (yes/no)
    - Does the reference ad show ANY environment like gym, sport setting, or location? (yes/no)
    - **Number of main visual elements:** Does the reference have ONE single hero element (e.g. one cookie, one product item only) or multiple (e.g. product + packaging, two items)? Answer: "one-hero-only" if there is exactly one main focal subject; "multiple" if there are two or more distinct main elements (e.g. packaging + item). This will be used to avoid adding packaging when the reference has only one hero.
    - If NO person and NO gym/environment: the ad is "graphic/product-only" (product + background/graphics only). The adaptation must STAY graphic — do not insert people or gym.
    - If it HAS a person (or people): the adaptation must **keep the same number of people and the same shot type** (e.g. hand holding product, selfie, couple, lifestyle) — **only the product identity changes** to the user's product; do not remove models or convert to a product-only layout unless explicitly requested.
    - If it HAS an environment but the key subject is people + product: preserve people; swap product only.

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
- Font style/type: [e.g. bold sans-serif, display, serif]
- Sizes and hierarchy: [headline size, body/copy size, any small text]
- Weights: [e.g. bold headline, regular body]
- Placement and alignment: [where text sits, alignment]
- Effects: [shadows, outlines, gradients on text, letter-spacing if visible]
(Describe everything needed to replicate the exact same typography in another ad.)

**VISUAL STYLE (REFERENCE AD):**
- Has person/character: [yes/no]
- Has gym, sport setting, or location environment: [yes/no]
- Main elements: [one-hero-only OR multiple] — if one-hero-only, the reference has a single main focal subject (e.g. one food item, one product); do not add packaging or a second element when adapting.
- Design type: [graphic-product-only OR has-person OR has-environment]
If "graphic-product-only": the ad is purely product + background/graphics (no people, no gym). The generated prompt must NOT add people or gym/sport imagery — only adapt product and keep the same graphic style. Only add person/gym if the user explicitly requests it in Guidelines.

**BRAND / LOGO PLACEMENT (REFERENCE AD):**
- Standalone brand logo in layout: [yes/no]
- Logo appears only on product packaging: [yes/no]
- Brand identity in layout type: [copy-only-text | logo-on-product-only | standalone-logo | standalone-and-product]
- Logo placement notes: [one sentence]

**COPYWRITING ANALYSIS:**
- Text Structure: [e.g. "Brand name + sub-tagline + headline (6 words) + spec line (8 words) + 4 icon labels" — ALL lines, word count per line]
- All text lines (top to bottom): [numbered list: role — exact text]
- Headline/Tagline Word Count: [exact number of words in the first/short line, e.g. 3]
- Main Copy Word Count: [exact number of words in the main slogan/second line, e.g. 5]
- Word Count: [total or main line word count]
- Rhetorical Figure: [primary figure: metaphor/personification/hyperbole/analogy/slogan/motivational/aspirational/wordplay/sarcasm/other]
- Tone: [tone: e.g. playful, sarcastic, humorous, serious, professional]
- Style: [style category]
- **Function of Line 2 (CRITICAL):** What does the second line do? (e.g. wordplay on a word like "uninterrupted" → "sleep interrupted", punchline, sarcastic twist, metaphor, benefit with a joke, double meaning). Describe so the generated ad can replicate the SAME function — the second line must NOT become a generic product spec (e.g. "45db noise cancelling") but must fulfill the same rhetorical role (e.g. clever twist, joke, wordplay).
- **Linguistic device of second line:** [wordplay / sarcasm / metaphor / joke / punchline / double meaning / straight benefit / other]. The new copy must use the same kind of device.
- **DO NOT COPY when adapting (product-specific data):** List any discount percentages (e.g. "64% OFF"), review numbers (e.g. "4.8/5 From 27,000+"), or other numerical claims in the reference. These must come ONLY from the scraped product page — never copy from reference.

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

function peopleModelsCriticalBlock(ctx: AdaptationContext): string {
  if (!ctx.hasPersonInReference) return '';
  return `**CRITICAL — KEEP PEOPLE / MODELS (reference shows humans):**
The reference ad includes one or more **people** (holding the product, using it, or in a location). You MUST **preserve the human presence** in the final ad:
- **Do NOT remove people** and do NOT turn the ad into a **product-only** shot (no models, floating product only, or empty background with product alone) unless the user explicitly requests that in Guidelines.
- **Do NOT replace the whole scene** with a different setting that drops the reference composition (e.g. do not remove a couple, a hand model, or a lifestyle shot just to "match category").
- **Replace ONLY the product** with the user's product from the provided image: same **number of people**, same **framing / camera angle**, same **hand positions, grip, and interaction** with the product (how they hold it, tilt, distance to face/body, product angle).
- **Avatars / appearance:** You MAY describe **different** faces, hair, skin tone, age, or styling for **diversity** ("fresh avatars"), but keep the **same poses, roles, and product interaction** as the reference.
- **Setting:** Keep the **same type of environment** as the reference (room, outdoor, gym, bathroom, etc.) unless Guidelines say otherwise — do not force a full location swap purely to match product category if that would **lose** the people or the shot type.
`;
}

function oneHeroBlock(ctx: AdaptationContext): string {
  if (!ctx.enforceOneMainElement) return '';
  return `**CRITICAL — ONE MAIN ELEMENT ONLY (no packaging):**
The reference ad has only ONE main visual hero (e.g. one cookie, one food item).${ctx.guidelinesAskSingleHero ? ' The user\'s Guidelines also specify a single main element (e.g. "gummy as the main element").' : ''}${ctx.hasPersonInReference ? ' **Exception:** If the reference also shows people, do NOT remove the people to satisfy "one hero" — this rule applies to product item vs packaging (e.g. one gummy vs pouch), not to removing models.' : ''} Your prompt MUST describe only that ONE hero as the focal subject — do NOT include product packaging, pouch, bag, or a second product in the scene. The main element is the product item itself (e.g. the gummy, the cookie) as the user requested or as the reference shows — not the packaging. If the product image shows packaging, ignore it for the hero; use only the single main element (e.g. the gummy itself) so the ad matches the reference's one-hero composition.
`;
}

function graphicOnlyBlock(ctx: AdaptationContext): string {
  if (!ctx.isGraphicOnly) {
    if (ctx.hasPersonInReference) {
      return `**Person/Environment (reference has people):** **Priority: keep the same people-based composition.** Only swap the product for the user's product; preserve models and interaction. Optional: refresh avatar diversity. Broader scene changes (e.g. gym vs home) only if user Guidelines ask for them.`;
    }
    return `**Person/Environment (reference has person or setting):** You may adapt the person/action or environment to match the new product context (e.g. creatine → gym) or follow user Guidelines.`;
  }
  return `**CRITICAL — REFERENCE AD IS GRAPHIC/PRODUCT-ONLY (no people, no gym):**
The reference ad has NO person and NO gym/sport environment — it is purely product + background/graphics (e.g. product, liquid splashes, fruits, gradients). You MUST keep the same style: do NOT add any person, athlete, gym, or sport environment. Do NOT insert "gym in background", "athletic couple", "person training", etc. Only product, background, and graphic elements. The ONLY exception: if the user explicitly asks for it in the Guidelines section below, then follow their request. Otherwise keep it graphic/product-only.`;
}

function analyzeProductContextBlock(ctx: AdaptationContext): string {
  const { isGraphicOnly, hasPersonInReference } = ctx;
  if (isGraphicOnly) {
    return `1. **Analyze Product Context (CRITICAL):**
   - Analyze the product image to understand: product type, category, purpose, target audience, industry
   - Keep the ad GRAPHIC: product + background/graphics only. Do NOT add people or gym/sport imagery unless the user requested it in Guidelines.
   - Always maintain the EXACT same design structure, composition, and layout from reference
   - Keep background and effects graphic only (e.g. liquid splashes, fruits, gradients) — no gym, no people.
   - Keep all visual design principles, effects, and aesthetics consistent`;
  }
  if (hasPersonInReference) {
    return `1. **Analyze Product Context (CRITICAL):**
   - Analyze the product image to understand: product type, category, purpose, target audience, industry
   - **People preserved (reference has models):** Keep the **same number of people**, same **shot type** (e.g. selfie, hand holding product, couple, lifestyle), and the **same interaction** with the product. **Replace ONLY the product** with the user's product. Do **not** remove models or switch to a product-only layout unless Guidelines require it.
     * You may adjust **minor** styling (wardrobe colors) if needed for plausibility, but **do not** change the core pose/action or remove people to "match use case".
   - Always maintain the EXACT same design structure, composition, and layout from reference
   - Keep the **same background/setting category** as the reference (e.g. same room type, same indoor/outdoor) unless Guidelines specify otherwise — do not discard the models or the location to force a category cliché.
   - Keep all visual design principles, effects, and aesthetics consistent`;
  }
  return `1. **Analyze Product Context (CRITICAL):**
   - Analyze the product image to understand: product type, category, purpose, target audience, industry
   - **Person and Action Adaptation (reference had person/environment):**
     * The person in the image MUST be performing actions or in poses that are coherent with how the NEW product is actually used
     * Example: If product is creatine: person could be in gym/sport setting. If reference showed another sport: you may adapt to gym for creatine, or follow Guidelines
     * **Do NOT copy the person's pose/action from reference if it doesn't match the NEW product's actual use case**
   - Always maintain the EXACT same design structure, composition, and layout from reference
   - Adapt contextual elements (background setting, person styling, actions/pose) to match the product category and use case, or per Guidelines.
   - Keep all visual design principles, effects, and aesthetics consistent`;
}

function maintainDesignElementsBlock(ctx: AdaptationContext): string {
  const { hasPersonInReference, isGraphicOnly, referenceProductPoseAndArrangement } = ctx;
  const poseNote = referenceProductPoseAndArrangement
    ? ' **in relation to the model(s)** (e.g. held in hand, near face)'
    : '';
  return `2. **Maintain ALL design elements** from the reference prompt:
   - Keep the EXACT same composition structure
   ${hasPersonInReference ? `- **People + product (CRITICAL):** The reference is a **people + product** shot. Explicitly describe **each person** (or "the model(s)") in the same positions as the reference, with the **user's product** replacing the old product in the **same hands / same hold / same angle** toward camera. Do not omit human figures from the prompt.` : ''}
   - **Product POSE AND ARRANGEMENT (CRITICAL — you MUST use the block above):** The reference ad has a specific product pose, order, and arrangement${poseNote} (e.g. lying horizontally, tips out, bases in, two pairs clustered, soft shadows). You MUST describe the user's product in THAT pose/arrangement in your final prompt — use the exact "PRODUCT POSE AND ARRANGEMENT" block provided, adapting only the product name to "the product from the provided image". Do NOT describe the product as it appears in the user's uploaded image (e.g. if their photo shows earplugs standing upright, ignore that — describe them in the reference pose: lying down, same angles and order). The image generator needs this so it composes a NEW scene with the user's product in the reference's layout; otherwise it will just overlay text on the upload.
   - **Product position and placement (CRITICAL — replicate exactly):** Identify in the reference ad how the product is positioned (inclined/tilted? which direction/angle?) and how it is placed relative to the background (e.g. submerged/nestled among fruit, with fruit wrapping around its base and sides, partially covering edges; or sitting on top). Your prompt MUST describe the SAME for the new product: same inclination/tilt and direction, same "submerged/nestled" relationship — background elements (fruits, objects) must surround the product, rise around its base and sides, partially obscure it where the reference does, so the product looks integrated into the scene, not floating or simply on top of a flat layer.
   - **Composition and framing (CRITICAL — match reference):** In the reference ad, background elements (e.g. fruits, objects, textures, scenery) fill the ENTIRE frame edge to edge; the product is centered. There are NO blank margins or empty white space around the edges. Your prompt MUST describe this: background and decorative elements must extend to all sides and fill the frame completely; full-bleed composition; no empty borders or white space.
   - Keep the EXACT same layout and positioning of all elements
   - Keep the EXACT same visual effects (lighting style, shadows, effects)
   ${isGraphicOnly ? '- Do NOT add any person/character or gym — reference ad is product + graphics only.' : hasPersonInReference ? '- **Person/Character:** **Keep the people.** Same count, same placement in frame, same interaction with the product. You may vary appearance for diversity (avatars) but **not** remove or replace the scene with a product-only mockup.' : "- **Person/Character**: Maintain the same visual style and presentation approach, BUT adapt the person's pose, expression, clothing, and actions to be coherent with the NEW product's actual use case (see section 4 for details)."}
   - Keep the EXACT same buttons/CTAs design and placement (if applicable)
   - **Typography: COPY the typography from the reference ad** — same font style/type, sizes, weights, text placement, alignment and text effects (shadows, outlines). The headline and copy must look like the reference ad's typography.`;
}

function replaceAdaptProductBlock(ctx: AdaptationContext): string {
  const { isGraphicOnly, hasPersonInReference, enforceOneMainElement } = ctx;
  const header = isGraphicOnly
    ? '4. **Replace/Adapt product references:**'
    : hasPersonInReference
      ? '4. **Replace/Adapt product references (keep all people; product swap only):**'
      : '4. **Replace/Adapt product references AND adapt people/actions to match product context (CRITICAL):**';

  let peopleBlock = '';
  if (isGraphicOnly) {
    peopleBlock =
      '- Keep the ad graphic: only product(s), background, and graphic elements (splashes, fruits, etc.). No people, no gym, no sport environment.';
  } else if (hasPersonInReference) {
    peopleBlock = `- **PEOPLE STAY — PRODUCT SWAPS (CRITICAL):**
     * **Do not remove or replace** the reference's people with a different layout. **Do not** convert to a category stock scene (e.g. forcing "gym for supplements") if the reference was a bathroom, car, or home — unless user Guidelines explicitly ask for that change.
     * Show the **same number of people** with the **same poses and composition**; the **user's product** appears **in the same hand-hold / use / placement** as the old product.
     * Optional: describe **new avatars** (different faces, hair, skin tone, age) for diversity while keeping **identical poses and interaction**.
   - If reference shows person holding product: describe the model(s) holding the **USER's product** with the **same grip, angle, and distance** as the reference.`;
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
   ${enforceOneMainElement ? `- **ONE MAIN ELEMENT ONLY:** The reference has one hero (e.g. one cookie). Show ONLY that one element for the new product — e.g. the gummy itself as the hero, NOT the product packaging or pouch. Do not describe or include packaging in the scene; the single focal subject is the product item (the gummy, the cookie, etc.) only.${hasPersonInReference ? ' **Still keep any people** from the reference — this rule is about item vs packaging, not removing models.' : ''}` : ''}
   - Replace product descriptions with the NEW product from the provided image
   - **Product presentation (CRITICAL — match reference style, never change product design):** The USER'S product (packaging, labels, logo, shape) must stay exactly as in the product image — never alter its design. Replicate the reference ad's product PRESENTATION exactly: (1) **Pose:** same orientation as reference — if the reference shows the product lying down, scattered, or at specific angles, the new product MUST be described in the same pose (e.g. "earplugs lying down on a white surface at slight angles" → user's earplugs also lying down at similar angles; never "standing upright" if reference shows lying down); (2) **Position:** same inclination/tilt and direction (e.g. leaning down and to the right, or tilted left); (3) **Placement:** same "submerged/nestled" look — the product must appear partially buried or integrated into the pile of fruits/objects, with those elements wrapping around its base and sides and partially obscuring edges, not sitting on top of a flat layer; (4) shadows, lighting, reflections, texture as in the reference. So: same product design always; pose, position, angle, submerged placement, shadow, light, texture must match the reference ad as closely as possible.
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
- **Product pose, position and placement (CRITICAL):** You MUST include the exact product pose and arrangement from the "PRODUCT POSE AND ARRANGEMENT" block above, adapted for "the product from the provided image". Describe the user's product in the REFERENCE pose${hasPersonInReference ? ' and **with the same model interaction** (hands, hold, angle)' : ''} (lying down, same angles, same order and overlap) — do NOT describe it as it appears in the uploaded image, or the generator will just add text to that image. Same "submerged/nestled" placement where applicable. Same shadows, lighting, reflections. Product design (colors, branding, shape) comes from the provided image; pose, angle, and arrangement come from the reference block.
${scrapedBranding ? "- Where the reference ad shows brand name or logo, specify that the product's brand logo (from the scraped page) appears in the same position and style for a personalized look." : ''}
- **Copy length and phrasing:** Describe EVERY text line from the reference (brand name, sub-tagline, headline, spec line, icon labels) — not a simplified 2-line layout. Tagline ≤ ${headlineWords} words; main secondary ≤ ${mainCopyWords} words. Same tone as reference; clear, conversion-ready copy. **The second line must fulfill the SAME function as the reference** (wordplay, punchline, sarcasm, metaphor) — never use generic product specs as main copy unless the reference does. Grammatically correct. Never one long sentence as the headline.
${ctx.hasReferenceFeatureRow ? '- **Icon/feature row:** Include the full icon row with same count, style, and placement as reference; use approved icon labels.' : ''}
- **STRICT DATA — ONLY scraped content:** Do NOT add "FREE GIFTS", "BIG DISCOUNTS", discount %, review numbers, or any promotional claim not in the scraped data. If not in scraped data, omit or use generic "SALE" / "Highly rated" (no numbers). Never invent or copy from reference.
${hasReferenceReviewModule ? `- **Review module present:** Include the review/testimonial/social-proof module in the final image description, matching the reference's visual placement/style. Adapt the testimonial to the user's product. Do not invent numeric rating/review counts unless present in scraped data.` : ''}
${enforceOneMainElement ? '- **One main element only:** The scene must have ONE hero (e.g. the gummy or product item only). Do NOT describe product packaging, pouch, or a second element in the image.' : ''}
${isGraphicOnly ? '- Keep the ad GRAPHIC: product + background/graphics only. No person, no gym, no sport environment (unless user requested it in Guidelines).' : hasPersonInReference ? "- **Keep people in the scene.** Same composition as reference; **only** the product is the user's. Optional avatar refresh for diversity." : "- Adapt contextual elements (person styling, actions/pose, setting) to match the NEW product's use case. Ensure the person is in coherent pose/action (e.g. exercising for fitness products)."}
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
${hasPersonInReference ? `**NOTE — Reference includes people (models):** This block describes how the product is shown **together with the same human interaction** as the reference (hands, hold, distance to face/body, angle). **Do NOT remove the people** to satisfy this block — keep the same number of models, framing, and interaction; only the **product identity** becomes the user's product from the provided image.
` : ''}The reference ad shows the product in a specific pose and arrangement. The image generator will use your description to COMPOSE the scene; if you describe the product in the reference's pose, it will render the user's product in that pose. If you describe the product as in the user's uploaded image, the result will just add text to that image (wrong).
You MUST include the following product pose and arrangement in your final prompt. Describe the USER'S product (from the provided image) in THIS exact pose and arrangement — not in the pose of the uploaded image:
---
${referenceProductPoseAndArrangement}
---
Adapt only the product name: write "the product from the provided image" or "the user's [product type] from the provided image" so the design/color/branding come from the image but the POSE, ORDER, ANGLE and ARRANGEMENT come from this block. **Prefer "in a row" / "side by side" over pyramid/triangle stacks** — a row looks cleaner. Your final prompt must contain a paragraph or bullet list that replicates this pose/arrangement for the user's product.`
    : '';

  const typographyBlock = referenceTypography
    ? `
**Typography from Reference Ad (COPY this typography into the final prompt):**
${referenceTypography}
You MUST replicate the same typography style, font appearance, sizes, weights, placement and text effects from the reference ad in your output.`
    : '';

  const approvedCopyBlock = options.approvedCopy
    ? `\n${formatApprovedCopyBlock(options.approvedCopy)}\n`
    : '';

  const visualBlock = options.visual
    ? `
**Visual adaptation (from product image analysis):**
- Product: ${options.visual.productType} — ${options.visual.productDescription}
- Pose/arrangement: ${options.visual.poseAndArrangementParagraph}
- People/scene: ${options.visual.peopleAndSceneRules}
- Composition: ${options.visual.compositionRules}
- Branding: ${options.visual.brandingNotes}
${options.visual.iconRowNotes ? `- Icon row: ${options.visual.iconRowNotes}` : ''}`
    : '';

  return `${options.preamble ?? 'You are an expert prompt engineer for AI static ad image generation (Kie.ai).'}

You have been given:

1. A DETAILED prompt that recreates the reference static ad design
2. An image of a NEW product that needs to replace the product in the reference ad
${isUrlScraped && scrapedSummary ? '3. Scraped product page information (summary and branding)' : ''}

**Reference Ad Prompt (use this as the base structure - maintain ALL design elements):**
${referencePrompt}
${typographyBlock}
${poseBlock}
${reviewModuleInstructions ? `\n${reviewModuleInstructions}` : ''}
${featureRowInstructionsBlock(ctx)}
${approvedCopyBlock}
${visualBlock}

${logoPlacementRulesBlock(ctx)}
${ctx.copyLanguageInstruction}
${ctx.pricingInstructions}

**REFERENCE PROMPT WARNING:** The reference block above may contain competitor prices (e.g. "$79 NOW"). IGNORE all dollar amounts from the reference. Follow PRICING rules above only.

**Your Task:**
Adapt the reference prompt above to create a NEW prompt for the product in the provided image. The new prompt must:

${peopleModelsCriticalBlock(ctx)}${oneHeroBlock(ctx)}${graphicOnlyBlock(ctx)}

${analyzeProductContextBlock(ctx)}

${maintainDesignElementsBlock(ctx)}

3. **Adapt Colors and Typography:**
${scrapedBranding ? brandingIntegration : '- Use reference colors and typography, but adapt product-specific elements'}
${scrapedBranding ? '- Integrate product brand colors from branding data where appropriate (product elements, accents, highlights)' : ''}
${scrapedBranding ? '- Prefer REFERENCE AD typography for headline and main copy; use product brand typography only for small product labels if needed' : ''}
- **Always preserve the reference ad typography** (font style, sizes, weights, placement, effects) so the new ad looks like the reference.
- Maintain reference color palette for background and overall design
- Use brand colors strategically for product elements and accents

${replaceAdaptProductBlock(ctx)}

5. **STRICT DATA RULE — Use scraped data when it HAS the info; omit when it doesn't:**
- **When scraped data CONTAINS discount %, offers, reviews — USE THEM.** E.g. if the page says "70% off", the ad must say "70% OFF". The scraped markdown has the full page content; extract and use exact numbers.
- **When scraped data does NOT contain it — OMIT.** Do NOT add "FREE GIFTS", "BIG DISCOUNTS", or invent numbers. Never copy from the reference ad.
- **Summary:** Use scraped data as source of truth. If 70% is in the data → use it. If free gifts are not in the data → do not add them.

6. **Create Copywriting (SAME TONE + CLEAR, PERFECT COPY — CRITICAL):**
${copywritingInstructions}
**The reference ad has SHORT text.** Match its tone and style exactly, but every phrase MUST be clear, understandable, and effective copywriting — no confusing or vague wordplay (e.g. avoid "GUMMIES YOU CAN BUILD WITH A POP" which is unclear; use clear lines like "TASTES LIKE BERRY", "BOOST YOUR STRENGTH", "5G CREATINE ZERO SUGAR"). Same brevity: short tagline (${ctx.headlineWords} words or fewer) and short main line (${ctx.mainCopyWords} words or fewer). Grammatically correct and natural. The copy must be immediately understandable and conversion-ready while keeping the reference's tone, rhetorical figure, and style. Do NOT describe one long headline. Describe all short lines that match the reference text architecture (brand, headline, spec line, icon labels). **REMEMBER: ALL promotional text (FREE GIFTS, BIG DISCOUNTS, discount %, review numbers, etc.) must come STRICTLY from scraped data. If not in scraped data, omit. Never invent or copy from the reference.**
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
  return `${ctx.copywritingInstructions}

**The reference ad has SHORT text (oldprompts finalPromptGeneration §6).** Match tone and style; every phrase clear and conversion-ready. Same brevity per line. Do NOT collapse multi-line layouts to 2 lines. Line 2 must fulfill the SAME rhetorical function as reference (wordplay/punchline/spec — match reference, not generic dumps). ALL promo claims from scraped data only.

**Text structure:** ${ctx.copywritingProfile?.textStructure ?? 'mirror every visible line from reference'}
**Function of line 2:** ${ctx.copywritingProfile?.functionOfLine2 ?? 'match reference'}
**Device:** ${ctx.copywritingProfile?.linguisticDeviceLine2 ?? 'match reference'}`;
}

/** Visual agent — secciones 2 y 4 de finalPromptGeneration */
export function buildVisualAgentInstructions(ctx: AdaptationContext): string {
  return `${maintainDesignElementsBlock(ctx)}

${replaceAdaptProductBlock(ctx)}`;
}
