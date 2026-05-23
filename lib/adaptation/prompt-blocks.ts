import { contextSummaryForAgent } from './context';
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
- Line 2+ must NOT become a generic spec dump unrelated to reference tone — match device (aspirational phrase, wordplay, etc.) from copywriting profile.
- Max words per line: headline/tagline ≤ ${ctx.headlineWords}, main secondary line ≤ ${ctx.mainCopyWords} (other lines match reference length).`;
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

${copyStructureRulesBlock(ctx)}

RULES:
- tagline: main headline (max ${ctx.headlineWords} words) — same rhetorical role as reference headline
- mainLine: secondary line (max ${ctx.mainCopyWords} words) — same function as reference line 2
- brandName / brandSubtagline / specLine / textLines / featureIcons: as in reference structure
- promoClaimsUsed / promoClaimsOmitted / reviewText / reviewNumericClaims
${ctx.pricingInstructions}
- NEVER copy competitor numbers, prices, or offers from reference

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

${featureRowInstructionsBlock(ctx)}

${buildVisualAgentInstructions(ctx)}

RULES (JSON output):
- poseAndArrangementParagraph: REFERENCE pose, NOT upload pose
- peopleAndSceneRules / compositionRules / brandingNotes / iconRowNotes

${ctx.referenceProductPoseAndArrangement ? `Reference pose:\n${ctx.referenceProductPoseAndArrangement}` : ''}

Context:
${contextSummaryForAgent(ctx)}

${logoPlacementRulesBlock(ctx)}
${ctx.copyLanguageInstruction}

Output JSON only:
{
  "productType": string,
  "productDescription": string,
  "poseAndArrangementParagraph": string,
  "peopleAndSceneRules": string,
  "compositionRules": string,
  "brandingNotes": string,
  "iconRowNotes": string
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
      ? `11. ICON ROW: Reference had feature/icon row — prompt must describe ${iconCount} icons with labels: ${copy.featureIcons!.map((i) => `"${i.label}"`).join(', ')}`
      : ctx.hasReferenceFeatureRow
        ? '11. ICON ROW: Reference had icon row but prompt omits it — FAIL'
        : '';

  const lineCount = copy.textLines?.length ?? 2;
  const structureCheck = `12. TEXT STRUCTURE: Prompt must include all ${lineCount} text blocks from approved copy (not a simplified 2-line ad if reference had more)`;

  return `You are a QA reviewer (oldprompts output requirements).

Check the final prompt. Return JSON: { "pass": boolean, "issues": string[] }

Rules:
1. No competitor promo numbers unless in promoClaimsUsed
2. Product pose from reference (not upload) — oldprompts §2 product POSE AND ARRANGEMENT
3. isGraphicOnly → no people/gym
4. hasPersonInReference → people still described
5. Approved copy verbatim: tagline "${copy.tagline}", mainLine "${copy.mainLine}"
6. Line 2 same rhetorical function as reference (not unrelated spec dump)
7. enforceOneMainElement → no packaging as second hero
8. Logo placement rules respected
9. Copy language: ${ctx.copyLanguageName} (${ctx.copyLanguageCode})
10. Pricing: ${ctx.allowedPrice ? `only "${ctx.allowedPrice}"` : 'no dollar amounts'}
${iconCheck}
${structureCheck}
13. Full-bleed composition, same layout modules as reference (oldprompts Output section)
14. Typography matches reference hierarchy

promoClaimsUsed: ${JSON.stringify(copy.promoClaimsUsed)}

Final prompt:
---
${finalPrompt.slice(0, 8000)}
---`;
}
