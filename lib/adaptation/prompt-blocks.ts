import { contextSummaryForAgent } from './context';
import {
  productCategoryAnchorBlock,
  textArchitectureRulesBlock,
} from './copy-sanitize';
import { creativeBridgeBlock } from './creative-bridge';
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
  productVariantMatchingBlock,
  realPersonPhotoStyleBlock,
  ctaSubscriptionGuardBlock,
  referenceCopyMirroringBlock,
  subheroCopyPatternBlock,
  textLayoutBlock,
  typographyHierarchyBlock,
  visualMetaphorExtrapolationBlock,
} from './adaptation-rules';
import {
  buildCopyAgentInstructions,
  buildFinalPromptGeneration,
  buildVisualAgentInstructions,
  featureRowInstructionsBlock,
  formatApprovedCopyBlock,
} from './old-prompts';
import { logoPlacementRulesBlock } from './logo-rules';
import type { AdaptationContext, CopyAdaptationResult, VisualAdaptationResult } from './types';

export {
  featureRowInstructionsBlock,
  formatApprovedCopyBlock,
} from './old-prompts';

export function copyStructureRulesBlock(ctx: AdaptationContext): string {
  const structure = ctx.copywritingProfile?.textStructure;
  return `**TEXT STRUCTURE (CRITICAL — match reference, not a simplified ad):**
${structure ? `Reference structure: "${structure}"` : 'Match the reference ad text hierarchy exactly (count every visible line: brand name, sub-tagline, headline, spec line, CTA, icon labels, etc.).'}
- Output the SAME number and TYPES of text blocks as the reference (e.g. brand wordmark + sub-tagline + serif headline + sans spec line + icon labels).
- Preserve rhetorical function per line: headline = emotional hook; spec line = condensed credentials/benefits (same brevity as reference); icon labels = 1–3 words each.
- Do NOT reduce a multi-line luxury layout to only "logo + one headline + one subline" unless the reference truly has only those elements.
- Line 2+ must NOT become a generic spec dump or unrelated authority claim ("Dermatologist recommended") — match reference rhetorical device (transparency, wordplay, contrarian hook, etc.).
- Max words per line: headline/tagline ≤ ${ctx.headlineWords}, main secondary line ≤ ${ctx.mainCopyWords} (other lines match reference length).
- **Visual size (image):** headline = largest tier; subhero = clearly smaller (~28–38% of headline height, light weight only) even if word count is higher; footer/reviews = smallest.
- **Subhero pattern:** ${ctx.line2Pattern} — mirror reference rhetorical structure; never swap curiosity-gap for product pitch; never swap benefit-bridge for authority/spec tropes from scrape.`;
}

/** Síntesis del agente — finalPromptGeneration completo de oldprompts.md */
export function synthesisTaskBlock(
  ctx: AdaptationContext,
  copy: CopyAdaptationResult,
  visual?: VisualAdaptationResult,
  extraBlocks?: string
): string {
  return buildFinalPromptGeneration(ctx, {
    approvedCopy: copy,
    visual,
    extraBlocks,
  });
}

export function copyAgentPrompt(ctx: AdaptationContext): string {
  return `You are a copy adaptation specialist for static ads (oldprompts finalPromptGeneration §6).

Clone the REFERENCE ad's text architecture for the USER's product — same number of lines, same roles (brand name, sub-tagline, headline, spec line, icon labels, etc.), same brevity per line.

${productCategoryAnchorBlock(ctx)}

${creativeBridgeBlock(ctx.creativeBridge)}

${productCreativeProfileBlock(ctx)}

${textArchitectureRulesBlock(ctx)}

${marketingAngleExtrapolationBlock(ctx)}

${referenceCopyMirroringBlock(ctx)}

${subheroCopyPatternBlock(ctx)}

${ctaSubscriptionGuardBlock(ctx)}

${textLayoutBlock(ctx)}

${copyStructureRulesBlock(ctx)}

RULES:
- tagline: main headline (max ${ctx.headlineWords} words) — same rhetorical role as reference headline but NEW wording (not verbatim from reference)
- mainLine: subhero/body (max ${ctx.mainCopyWords} words) — pattern **${ctx.line2Pattern}**${ctx.line2Pattern === 'product-helps-you' ? '; MUST use "[Product] helps you [outcome] & [outcome]" only because reference did' : ctx.line2Pattern === 'curiosity-gap' || ctx.line2Pattern === 'pain-agitation' ? '; MUST NOT name product or use "helps you"' : ''}
- brandName / brandSubtagline / specLine / textLines / featureIcons: as in reference structure
- promoClaimsUsed / promoClaimsOmitted: ${ctx.referenceHasPromoOfferLine ? 'only promos explicitly in scraped data' : 'MUST be [] — reference has no promo line; do not add flash sales or % off'}
- reviewText / reviewNumericClaims
${ctx.pricingInstructions}
- NEVER copy competitor numbers, prices, hooks, or offers from reference
${ctx.referenceVerbatimPhrases.length ? `- Forbidden verbatim phrases: ${ctx.referenceVerbatimPhrases.join(', ')}` : ''}

${buildCopyAgentInstructions(ctx)}

Context:
${contextSummaryForAgent(ctx)}
${ctx.referenceFeatureRow ? `Feature row blueprint:\n${ctx.referenceFeatureRow.slice(0, 1500)}` : ''}

${ctx.manualCopywriting ? `User copy (adapt, keep structure):\n"${ctx.manualCopywriting}"` : ''}

${logoPlacementRulesBlock(ctx)}
${ctx.copyLanguageInstruction}

Output JSON only:
{
  "brandName": string | null,
  "brandSubtagline": string | null,
  "tagline": string,
  "mainLine": string,
  "specLine": string | null,
  "textLines": [{ "role": string, "text": string }],
  "featureIcons": [{ "iconDescription": string, "label": string }],
  "promoClaimsUsed": string[],
  "promoClaimsOmitted": string[],
  "reviewText": string | null,
  "reviewNumericClaims": string | null,
  "notes": string
}`;
}

export function visualAgentPrompt(ctx: AdaptationContext): string {
  const multiImageNote =
    ctx.matchedProductVisuals.length > 1
      ? `\nMultiple product images (${ctx.matchedProductVisuals.length}), roles:\n${ctx.matchedProductVisuals.map((m) => `- ${m.role}: ${m.description}`).join('\n')}`
      : '';

  return `You are a visual adaptation specialist for AI image generation prompts (oldprompts finalPromptGeneration §§2, 4).

Define how the USER's product appears in a CLONED ad — identical layout to reference, new product/brand.
${multiImageNote}

${productCategoryAnchorBlock(ctx)}

${creativeBridgeBlock(ctx.creativeBridge)}

${productCreativeProfileBlock(ctx)}

${visualMetaphorExtrapolationBlock(ctx)}

${marketingAngleExtrapolationBlock(ctx)}

${productCatalogFidelityBlock(ctx)}

${productVariantMatchingBlock(ctx)}

${productThemedEnvironmentBlock(ctx)}

${productPlacementOnModelBlock(ctx)}

${realPersonPhotoStyleBlock(ctx)}

${illustrativeVisualBlock(ctx)}

${noStockPhotoUnlessReferenceBlock(ctx)}

${packagingMirroringBlock(ctx)}

${backgroundColorAdaptationBlock(ctx)}

${featureRowInstructionsBlock(ctx)}

${buildVisualAgentInstructions(ctx)}

${typographyHierarchyBlock(ctx)}

${textLayoutBlock(ctx)}

${layoutProportionsBlock(ctx)}

${beforeAfterComparisonBlock(ctx)}

RULES (JSON output):
- visualMediumNotes: describe the reference ad's visual style for product + layout (hyperreal photo, stylized, 3D, mixed, matte/gloss texture) — match reference dynamically; product may be hyperreal even in design ads
- poseAndArrangementParagraph: mirror reference LAYOUT zones only; user's product form comes from catalog photos — if reference had a bottle but user has gummy pouch, describe the pouch in that zone; NEVER describe a bottle/jar unless catalog shows one${ctx.hasPersonInReference && ctx.productUseProfile ? `; **${ctx.productUseProfile.category}:** ${ctx.productUseProfile.placementInstruction}` : ctx.hasPersonInReference ? '; describe correct anatomical placement on model (not floating on wrong body part)' : ''}
- peopleAndSceneRules: must state on-theme environment/props for user's product category; clone reference framing/mood/aesthetic, NOT competitor-category setting when categories differ${ctx.hasPersonInReference ? '; **specify authentic product-on-body placement** (wear/apply/hold/consume correctly); for real photos: **iPhone candid snapshot** — match reference close-up distance, expression, motion/handheld feel — NOT stock sunset catalog polish' : ''}
- compositionRules / brandingNotes / iconRowNotes / trustBadgeNotes
- compositionRules: visual hierarchy (headline → icon/feature row → product row → CTA bar); preserve reference **vertical band proportions** and text block geometry; product row with **exact unit count** from reference (use distinct catalog variants when reference shows different flavors/colors); award seal overlaps product per reference; **typography size ladder** — headline largest, subheadline clearly smaller, footer/CTA smallest
${ctx.referenceTrustBadge.present ? `- trustBadgeNotes: describe placing user's award seal (${ctx.referenceTrustBadge.placement || 'overlap on hero product'})` : ''}
${ctx.trustBadgeInstructions ? ctx.trustBadgeInstructions : ''}

${ctx.referenceProductPoseAndArrangement ? `Reference pose:\n${ctx.referenceProductPoseAndArrangement}` : ''}
${ctx.referencePhotoStyle ? `\nReference photography style:\n${ctx.referencePhotoStyle}` : ''}

Context:
${contextSummaryForAgent(ctx)}

${logoPlacementRulesBlock(ctx)}
${ctx.copyLanguageInstruction}

Output JSON only:
{
  "productType": string,
  "productDescription": string,
  "visualMediumNotes": string,
  "poseAndArrangementParagraph": string,
  "peopleAndSceneRules": string,
  "compositionRules": string,
  "brandingNotes": string,
  "iconRowNotes": string,
  "trustBadgeNotes": string | null,
  "comparisonModuleNotes": string | null
}`;
}

export function qaRulesBlock(
  ctx: AdaptationContext,
  copy: CopyAdaptationResult,
  finalPrompt: string
): string {
  const iconCount = copy.featureIcons?.length ?? 0;
  const iconCheck =
    ctx.hasReferenceFeatureRow && iconCount > 0
      ? `13. ICON ROW: Reference had feature/icon row — prompt must describe ${iconCount} icons with labels: ${copy.featureIcons!.map((i) => `"${i.label}"`).join(', ')}`
      : ctx.hasReferenceFeatureRow
        ? '13. ICON ROW: Reference had icon row but prompt omits it — FAIL'
        : '';

  const lineCount = copy.textLines?.length ?? 2;
  const structureCheck = `14. TEXT STRUCTURE: Prompt must include all ${lineCount} text blocks from approved copy (not a simplified 2-line ad if reference had more)`;

  return `You are a QA reviewer (oldprompts output requirements).

Check the final prompt. Return JSON: { "pass": boolean, "issues": string[] }

Rules:
1. No competitor promo numbers unless in promoClaimsUsed; if referenceHasPromoOfferLine is false, promoClaimsUsed must be empty and prompt must not mention flash sale / % off. ${ctx.referenceHasPriceVisual ? '' : 'referenceHasPriceVisual is false → prompt must NOT contain any dollar amount, strikethrough price, "$X / $Y", or "SPECIAL DEAL $X" (a "% OFF" promo line is OK, a price is NOT).'}
2. Tagline must not match referenceVerbatimPhrases (no plagiarized hooks)
3. Product pose from reference (not upload) — oldprompts §2 product POSE AND ARRANGEMENT
4. hasIllustrativeVisual without real people → no stock photo people/faces unless reference had them; product render may be hyperreal OR stylized per reference — FAIL only if prompt adds real photo models when reference had none
5. hasPersonInReference → real photo people still described; user's product in authentic use${ctx.productUseProfile && ctx.productUseProfile.confidence !== 'low' ? ` — for ${ctx.productUseProfile.category}, product must be on **${ctx.productUseProfile.bodyZone}**; FAIL if floating on wrong body part (${ctx.productUseProfile.forbiddenPlacements.slice(0, 2).join(', ')})` : ' with correct anatomical placement'}; FAIL if prompt describes glossy stock/AI fitness shoot, perfect catalog pose, or hyper-sharp retouch when reference was candid close-up — must mention **iPhone/smartphone candid photo** quality and match reference expression + camera feel (motion blur/handheld if reference had it)
${ctx.creativeBridge ? `5b. CREATIVE BRIDGE: Prompt must reflect adapted hook "${ctx.creativeBridge.adaptedHook.slice(0, 120)}" — FAIL if generic template copy ignores reference emotional structure; FAIL if visual-swap of competitor scene without native product concept` : ''}
6. Line 2 mirrors reference rhetorical device — FAIL if generic authority/trope unrelated to reference (e.g. "Dermatologist recommended" when reference had ingredient transparency)
7. Headline mirrors reference sentence structure — FAIL if generic category headline when reference had contrarian/comparative hook
8. Background uses product brand colors — FAIL if competitor category color copied (e.g. coffee brown for non-coffee product)
9. Approved copy verbatim: tagline "${copy.tagline}", mainLine "${copy.mainLine}"
10. Line 2 same rhetorical function as reference (not unrelated spec dump)
11. enforceOneMainElement → no packaging as second hero (only when referenceShowsPackaging is false)
${ctx.referenceShowsPackaging ? '11b. PACKAGING: Reference had packaging zone — prompt must show USER catalog packaging in same position; FAIL if reference competitor bottle/jar shape or wrong container type (e.g. bottle when catalog has pouch/gummies)' : ''}
21. PRODUCT FIDELITY: Prompt must render user's catalog product ONLY — FAIL if competitor product appears as hero, competitor category is reskinned (e.g. bedding package with user label when user sells a drink), or packaging not in catalog is invented
22. PRODUCT-THEMED ENVIRONMENT: FAIL if competitor's sellable product category is shown; scene props OK when semantically fitting (e.g. rumpled sheets under user's sleep beverage can)
23. PACKAGING LOGO: FAIL if prompt invents standalone footer/centered brand wordmark when reference was copy-only; logo must come from packaging print unless reference had standalone logo zone
12. Logo placement rules respected
13. Copy language: ${ctx.copyLanguageCode} (${ctx.copyLanguageName})
14. Pricing: ${ctx.referenceHasPriceVisual ? (ctx.allowedPrice ? `reference had price badge — only "${ctx.allowedPrice}"` : 'reference had price badge but no verified product price — omit badge') : 'reference had NO price badge — FAIL if any $ amount, price sticker, or price tag appears'}
${ctx.referenceTrustBadge.present ? `12. TRUST BADGE: Reference had award seal — prompt must describe overlapping trust badge${ctx.matchedProductVisuals.some((m) => m.role === 'trust_badge') ? ' (product catalog includes trust_badge image)' : ' — FAIL if omitted'}` : ''}
${iconCheck}
${structureCheck}
15. Full-bleed composition, same layout modules as reference (oldprompts Output section)
16. TYPOGRAPHY HIERARCHY: Prompt must specify headline DOMINANT and subhero clearly SMALLER (~28–38% cap height, light/regular weight). FAIL if equal sizes, bold subhero, or ~50%+ headline size.
${ctx.typographyHierarchy?.sizeRatioHeadlineToSub ? `    Reference ratio hint: ${ctx.typographyHierarchy.sizeRatioHeadlineToSub}` : ''}
17. SUBHERO COPY PATTERN (${ctx.line2Pattern}): ${ctx.line2Pattern === 'product-helps-you' ? 'mainLine MUST follow "helps you" benefit bridge — FAIL if starts with Dermatologist/Clinically/Doctor recommended' : ctx.line2Pattern === 'curiosity-gap' || ctx.line2Pattern === 'pain-agitation' ? 'FAIL if mainLine or textLines name user product/brand or use "helps you" / benefit pitch when reference had curiosity gap' : 'mainLine must match reference line 2 function — FAIL if unrelated authority/spec dump from scrape'}
18. Approved mainLine must match pattern: "${copy.mainLine}" — reject if authority-led subhero when line2Pattern is product-helps-you or benefit-bullet-list; reject if product pitch when line2Pattern is curiosity-gap or pain-agitation
${ctx.marketingAngle && !ctx.marketingAngle.productMentionedInCopy ? '18b. MARKETING ANGLE: Reference had NO product in copy — FAIL if prompt or copy names user product or "[Brand] helps you"' : ''}
${ctx.visualMetaphor?.present ? `19. VISUAL METAPHOR: Reference used symbolic hero (${ctx.visualMetaphor.symbolicMeaning}) — FAIL if prompt uses generic product packshot instead of analogous metaphor; FAIL if headline word contradicts image (e.g. "Flat"/"Deflated" with plump/full product)` : ''}
24. NO DUPLICATE TEXT: Each approved copy line must appear in the final prompt exactly ONCE — FAIL if any dismissal, headline, or body phrase is repeated (e.g. "Just tired" listed twice)
${ctx.hasReferenceComparisonModule ? `26. LAYOUT PROPORTIONS: FAIL if prompt splits frame ~50/50 when reference has small header band (${ctx.referenceLayoutZones?.headerBandPercent ?? '~30%'}) + large comparison (${ctx.referenceLayoutZones?.mainModulePercent ?? '~70%'})` : ctx.referenceLayoutZones ? `26. LAYOUT PROPORTIONS: FAIL if equal halves when reference bands are ${ctx.referenceLayoutZones.headerBandPercent} / ${ctx.referenceLayoutZones.mainModulePercent}` : ''}
27. PACKAGING PHOTO: When reference top band shows labeled bottle/box/tube, prompt must use user packaging catalog photo — FAIL if lifestyle grass/scene photo used as hero
${ctx.hasReferenceComparisonModule ? `19. BEFORE/AFTER: Prompt must describe natural side-by-side panels — FAIL if "vertical split face", harsh bisect, full portrait when reference was macro crop, or oversized Before/After labels` : ''}
${ctx.referenceTextLayout ? `20. TEXT LAYOUT: Top copy must be ${ctx.referenceTextLayout.alignment}-aligned ${ctx.referenceTextLayout.stackDirection} stack — FAIL if subhero same visual size as hero` : ''}

${ctx.referenceProductUnits && ctx.referenceProductUnits.unitCount > 1 ? `28. PRODUCT VARIANTS: Reference had ${ctx.referenceProductUnits.unitCount} units${ctx.referenceProductUnits.distinctVariants ? ' with distinct variants' : ''} — FAIL if prompt shows ${ctx.referenceProductUnits.unitCount} identical copies of one flavor when reference had distinct variants and user catalog has multiple variant photos` : ''}
${!ctx.referenceTextLines.some((l) => /cta|button/i.test(l.role) && /\bsubscribe\b/i.test(l.text)) ? '29. CTA: FAIL if prompt/footer includes "Subscribe", "Subscribe & Save", or auto-ship language when reference CTA did not' : ''}

referenceHasPromoOfferLine: ${ctx.referenceHasPromoOfferLine}
referenceHasPriceVisual: ${ctx.referenceHasPriceVisual}
referenceVerbatimPhrases: ${JSON.stringify(ctx.referenceVerbatimPhrases)}

promoClaimsUsed: ${JSON.stringify(copy.promoClaimsUsed)}

Final prompt:
---
${finalPrompt.slice(0, 8000)}
---`;
}
