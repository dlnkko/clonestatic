import { contextSummaryForAgent } from './context';
import {
  backgroundColorAdaptationBlock,
  beforeAfterComparisonBlock,
  illustrativeVisualBlock,
  marketingAngleExtrapolationBlock,
  noStockPhotoUnlessReferenceBlock,
  packagingMirroringBlock,
  productCatalogFidelityBlock,
  productThemedEnvironmentBlock,
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

${marketingAngleExtrapolationBlock(ctx)}

${referenceCopyMirroringBlock(ctx)}

${subheroCopyPatternBlock(ctx)}

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

${visualMetaphorExtrapolationBlock(ctx)}

${marketingAngleExtrapolationBlock(ctx)}

${productCatalogFidelityBlock(ctx)}

${productThemedEnvironmentBlock(ctx)}

${illustrativeVisualBlock(ctx)}

${noStockPhotoUnlessReferenceBlock(ctx)}

${packagingMirroringBlock(ctx)}

${backgroundColorAdaptationBlock(ctx)}

${featureRowInstructionsBlock(ctx)}

${buildVisualAgentInstructions(ctx)}

${typographyHierarchyBlock(ctx)}

${textLayoutBlock(ctx)}

${beforeAfterComparisonBlock(ctx)}

RULES (JSON output):
- visualMediumNotes: state whether final ad is illustration/diagram/3d-render OR real photo — must match reference, never default to stock lifestyle photo when reference is graphic
- poseAndArrangementParagraph: mirror reference LAYOUT zones only; user's product form comes from catalog photos — if reference had a bottle but user has gummy pouch, describe the pouch in that zone; NEVER describe a bottle/jar unless catalog shows one
- peopleAndSceneRules: must state on-theme environment/props for user's product category; clone reference framing/mood/aesthetic, NOT competitor-category setting when categories differ
- compositionRules / brandingNotes / iconRowNotes / trustBadgeNotes
- compositionRules: visual hierarchy (headline → comparison/table → product row), spacing, shadows, full-bleed; product row with 2–4 units if reference shows multiple; award seal overlaps product per reference; **typography size ladder** — headline largest, subheadline clearly smaller, footer smallest
${ctx.referenceTrustBadge.present ? `- trustBadgeNotes: describe placing user's award seal (${ctx.referenceTrustBadge.placement || 'overlap on hero product'})` : ''}
${ctx.trustBadgeInstructions ? ctx.trustBadgeInstructions : ''}

${ctx.referenceProductPoseAndArrangement ? `Reference pose:\n${ctx.referenceProductPoseAndArrangement}` : ''}

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
1. No competitor promo numbers unless in promoClaimsUsed; if referenceHasPromoOfferLine is false, promoClaimsUsed must be empty and prompt must not mention flash sale / % off
2. Tagline must not match referenceVerbatimPhrases (no plagiarized hooks)
3. Product pose from reference (not upload) — oldprompts §2 product POSE AND ARRANGEMENT
4. isGraphicOnly or hasIllustrativeVisual → no real photographic people; use illustration/diagram if reference did
5. hasPersonInReference → real photo people still described; user's product in authentic use
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
${ctx.hasReferenceComparisonModule ? `19. BEFORE/AFTER: Prompt must describe natural side-by-side panels — FAIL if "vertical split face", harsh bisect, full portrait when reference was macro crop, or oversized Before/After labels` : ''}
${ctx.referenceTextLayout ? `20. TEXT LAYOUT: Top copy must be ${ctx.referenceTextLayout.alignment}-aligned ${ctx.referenceTextLayout.stackDirection} stack — FAIL if subhero same visual size as hero` : ''}

referenceHasPromoOfferLine: ${ctx.referenceHasPromoOfferLine}
referenceVerbatimPhrases: ${JSON.stringify(ctx.referenceVerbatimPhrases)}

promoClaimsUsed: ${JSON.stringify(copy.promoClaimsUsed)}

Final prompt:
---
${finalPrompt.slice(0, 8000)}
---`;
}
