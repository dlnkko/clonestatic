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
  return `You are the copy agent. Output FINAL ad text only — the image model will render your strings verbatim; it does not write copy.

Clone the reference ad's text architecture for the user's product: same number of lines, same roles (headline, subheadline, badge, icon labels, etc.).

${productCategoryAnchorBlock(ctx)}

${creativeBridgeBlock(ctx.creativeBridge)}

${marketingAngleExtrapolationBlock(ctx)}

${referenceCopyMirroringBlock(ctx)}

${subheroCopyPatternBlock(ctx)}

${ctaSubscriptionGuardBlock(ctx)}

${copyStructureRulesBlock(ctx)}

Rules:
- tagline/headline: max ${ctx.headlineWords} words — NEW wording, same rhetorical role as reference
- mainLine/subheadline: max ${ctx.mainCopyWords} words — pattern **${ctx.line2Pattern}**
- promoClaimsUsed: ${ctx.referenceHasPromoOfferLine ? 'only from scraped data' : '[] — reference has no promo line'}
- Never copy reference phrases verbatim${ctx.referenceVerbatimPhrases.length ? `: ${ctx.referenceVerbatimPhrases.join(', ')}` : ''}
${ctx.pricingInstructions}
${ctx.copyLanguageInstruction}

${buildCopyAgentInstructions(ctx)}

Context:
${contextSummaryForAgent(ctx)}

${ctx.manualCopywriting ? `User copy seed:\n"${ctx.manualCopywriting}"` : ''}

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
      ? `Catalog images (${ctx.matchedProductVisuals.length}): ${ctx.matchedProductVisuals.map((m) => m.role).join(', ')}`
      : '';

  return `You are the visual/composition agent. Define HOW the ad looks — not the copy text.

Output layout, background, composition, and visual medium for a cloned ad. Reference ad = composition + style only. User catalog = brand truth (colors, logo, label) — NOT fixed catalog photo pose.

${multiImageNote}

${productCatalogFidelityBlock(ctx)}

${visualMetaphorExtrapolationBlock(ctx)}

${productThemedEnvironmentBlock(ctx)}

${productPlacementOnModelBlock(ctx)}

${illustrativeVisualBlock(ctx)}

${realPersonPhotoStyleBlock(ctx)}

${backgroundColorAdaptationBlock(ctx)}

${layoutProportionsBlock(ctx)}

${typographyHierarchyBlock(ctx)}

${textLayoutBlock(ctx)}

${buildVisualAgentInstructions(ctx)}

Key rules for JSON fields:
- visualMediumNotes: photo | illustration | diagram | mixed — match reference, never default to stock gym photo when reference is graphic
- poseAndArrangementParagraph: describe layout zones and unit arrangement from reference (overlap, diagonal row, centered hero) — say product may be re-posed/re-angled/re-scaled at render; do NOT require copying catalog photo pose
- peopleAndSceneRules: on-theme environment for user's product category; match reference framing/mood
- compositionRules: text zones, product row, icon row, vertical bands — no copy text
- brandingNotes: background gradient/colors using user brand hues
- iconRowNotes / trustBadgeNotes: placement only if reference had them

${ctx.referenceProductPoseAndArrangement ? `Reference layout notes (composition only, not rigid pose):\n${ctx.referenceProductPoseAndArrangement.slice(0, 1200)}` : ''}

Context:
${contextSummaryForAgent(ctx)}

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
  "trustBadgeNotes": string | null
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
1. No competitor promo numbers unless in promoClaimsUsed; if referenceHasPromoOfferLine is false, promoClaimsUsed must be empty and prompt must not mention flash sale / % off
2. Tagline must not match referenceVerbatimPhrases (no plagiarized hooks)
3. Product pose from reference (not upload) — oldprompts §2 product POSE AND ARRANGEMENT
4. isGraphicOnly or hasIllustrativeVisual → no real photographic people; prompt must describe illustration/diagram/stylized graphic matching reference medium — FAIL if prompt requests hyperrealistic photo, sweaty skin macro, or stock fitness model when reference was illustrated/stylized anatomy
5. hasPersonInReference → real photo people still described; user's product in authentic use${ctx.productUseProfile && ctx.productUseProfile.confidence !== 'low' ? ` — for ${ctx.productUseProfile.category}, product must be on **${ctx.productUseProfile.bodyZone}**; FAIL if floating on wrong body part (${ctx.productUseProfile.forbiddenPlacements.slice(0, 2).join(', ')})` : ' with correct anatomical placement'}; FAIL if prompt describes glossy stock/AI fitness shoot, perfect catalog pose, or hyper-sharp retouch when reference was candid close-up — must mention **iPhone/smartphone candid photo** quality and match reference expression + camera feel (motion blur/handheld if reference had it)
${ctx.creativeBridge ? `5b. CREATIVE BRIDGE: Prompt must reflect adapted hook "${ctx.creativeBridge.adaptedHook.slice(0, 120)}" — FAIL if generic template copy ignores reference emotional structure; FAIL if visual-swap of competitor scene without native product concept` : ''}
6. Line 2 mirrors reference rhetorical device — FAIL if generic authority/trope unrelated to reference (e.g. "Dermatologist recommended" when reference had ingredient transparency)
7. Headline mirrors reference sentence structure — FAIL if generic category headline when reference had contrarian/comparative hook
8. Background uses product brand colors — FAIL if competitor category color copied (e.g. coffee brown for non-coffee product)
9. Approved copy verbatim: tagline "${copy.tagline}", mainLine "${copy.mainLine}"
10. Line 2 same rhetorical function as reference (not unrelated spec dump)
11. enforceOneMainElement → no packaging as second hero (only when referenceShowsPackaging is false)
${ctx.referenceShowsPackaging ? '11b. PACKAGING: Reference had packaging zone — prompt must show USER catalog packaging in same position; FAIL if reference competitor bottle/jar shape or wrong container type (e.g. bottle when catalog has pouch/gummies)' : ''}
21. PRODUCT FIDELITY: Prompt must render user's product ONLY from catalog photos — FAIL if prompt describes reference competitor product, reskins reference bottle with user brand, or inventing packaging not in catalog
22. PRODUCT-THEMED ENVIRONMENT: Prompt must describe setting/props on-theme for user's product category — FAIL if competitor environment copied (e.g. bedroom/bedsheets when product is creatine/fitness)
23. PACKAGING LOGO: FAIL if prompt invents standalone footer/centered brand wordmark when reference was copy-only; logo must come from packaging print unless reference had standalone logo zone
12. Logo placement rules respected
13. Copy language: ${ctx.copyLanguageCode} (${ctx.copyLanguageName})
14. Pricing: ${ctx.allowedPrice ? `only "${ctx.allowedPrice}"` : 'no dollar amounts'}
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
referenceVerbatimPhrases: ${JSON.stringify(ctx.referenceVerbatimPhrases)}

promoClaimsUsed: ${JSON.stringify(copy.promoClaimsUsed)}

Final prompt:
---
${finalPrompt.slice(0, 8000)}
---`;
}
