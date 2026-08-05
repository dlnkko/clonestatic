import type { GoogleGenAI } from '@google/genai';
import { costFromUsage, mergeStep2Usage } from './cost';
import { generateText, generateWithProductImages, parseJson } from './gemini';
import {
  findDuplicateCopyIssues,
  findDuplicateLinesInPrompt,
  sanitizeAdaptedCopy,
  findCompetitorCategoryLeakViolations,
} from './copy-sanitize';
import { sanitizeImagePromptForKie } from './sanitize-image-prompt';
import { copyAgentPrompt } from './prompt-blocks';
import { buildCall3FinalPrompt } from './old-prompts';
import {
  findCatalogContainerViolations,
  findProductVisibilityViolations,
  findInventedScreenViolations,
} from '@/lib/products/catalog-container';
import type {
  AdaptationContext,
  CopyAdaptationResult,
  Step2Result,
} from './types';

function normalizeCopy(
  raw: CopyAdaptationResult,
  ctx: AdaptationContext
): CopyAdaptationResult {
  const copy = sanitizeAdaptedCopy(raw, ctx);
  const dupes = findDuplicateCopyIssues(copy);
  if (dupes.length > 0) {
    console.warn('\n=== COPY SANITIZE: fixed duplicate lines ===', dupes);
  }
  return copy;
}

/** Call 2 — adapt copy only (text, no product images). */
async function runCopyAgent(
  ai: GoogleGenAI,
  ctx: AdaptationContext,
  fixIssues?: string[]
): Promise<{ copy: CopyAdaptationResult; usage: ReturnType<typeof mergeStep2Usage> }> {
  const feedback =
    fixIssues && fixIssues.length > 0
      ? `\nFix these issues before writing copy:\n${fixIssues.map((i) => `- ${i}`).join('\n')}\n`
      : '';
  const prompt = `${copyAgentPrompt(ctx)}${feedback}`;
  const { text, usage } = await generateText(ai, prompt, { json: true });
  const copy = normalizeCopy(parseJson<CopyAdaptationResult>(text), ctx);
  console.log('\n=== CALL 2: Copy adaptation ===', {
    tagline: copy.tagline,
    mainLine: copy.mainLine,
    textLineCount: copy.textLines?.length,
  });
  return { copy, usage };
}

/** Call 3 — final Kie prompt with product images + approved copy (visual + synthesis merged). */
async function runFinalPromptAgent(
  ai: GoogleGenAI,
  ctx: AdaptationContext,
  copy: CopyAdaptationResult,
  productFiles: { uri: string; mimeType?: string }[],
  fixIssues?: string[]
): Promise<{ finalPrompt: string; usage: ReturnType<typeof mergeStep2Usage> }> {
  const feedback =
    fixIssues && fixIssues.length > 0
      ? `\nFix these issues:\n${fixIssues.map((i) => `- ${i}`).join('\n')}\n`
      : '';

  const textGuard = `\nQuote each approved copy line exactly once, top-to-bottom.\n`;
  const prompt = buildCall3FinalPrompt(ctx, copy, `${textGuard}${feedback}`);

  const { text, usage } = await generateWithProductImages(ai, productFiles, prompt);
  if (!text) throw new Error('Final prompt generation returned empty');
  const finalPrompt = sanitizeImagePromptForKie(text);
  return { finalPrompt, usage };
}

function programmaticQa(
  ctx: AdaptationContext,
  copy: CopyAdaptationResult,
  finalPrompt: string
): string[] {
  const issues = [
    ...findDuplicateCopyIssues(copy),
    ...findDuplicateLinesInPrompt(copy, finalPrompt),
    ...findCatalogContainerViolations(finalPrompt, ctx.catalogContainerHint),
    ...findProductVisibilityViolations(finalPrompt, ctx.referenceProductVisibility),
    ...findInventedScreenViolations(finalPrompt, ctx.productName, ctx.productDescription),
    ...findCompetitorCategoryLeakViolations(copy, finalPrompt, ctx),
  ];
  if (ctx.referenceHasPriceVisual && ctx.allowedPrice) {
    if (!finalPrompt.includes(ctx.allowedPrice)) {
      issues.push(`Missing allowed price ${ctx.allowedPrice}`);
    }
  } else if (/\$\d|price badge|price sticker/i.test(finalPrompt)) {
    issues.push('Reference had no price badge — remove dollar amounts from prompt');
  }

  const g = ctx.guidelinesTrimmed?.trim();
  if (g && g.length >= 8) {
    const lowerP = finalPrompt.toLowerCase();
    const tokens = g
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !/^(make|with|that|this|from|into|them|they|wear|wearing|using|want|please|just|also)$/.test(w));
    const missing = tokens.filter((w) => !lowerP.includes(w)).slice(0, 4);
    if (missing.length >= 1 && tokens.length <= 12) {
      issues.push(
        `USER GUIDELINES not followed in image prompt — include and obey: "${g.slice(0, 180)}"`
      );
    }
    if (
      /\b(wear|wearing|in (?:the |its |their )?ears?)\b/i.test(g) &&
      /\b(tongue|in (?:the |its )?mouth|inside (?:the |its )?mouth)\b/i.test(lowerP)
    ) {
      issues.push('USER GUIDELINES: product must be worn correctly (e.g. in ears), not in the mouth');
    }
  }
  return issues;
}

/**
 * 3-call Gemini pipeline (Step 2 portion):
 * - Call 2: copy adaptation
 * - Call 3: final image prompt (sees catalog product images)
 * (Call 1 = reference analysis, run upstream in generate-static-ad-prompt)
 */
export async function runAdaptationAgent(
  ai: GoogleGenAI,
  ctx: AdaptationContext,
  productFiles: { uri: string; mimeType?: string }[]
): Promise<Step2Result> {
  console.log('\n=== STEP 2: 3-CALL PIPELINE (copy + final prompt) ===');

  const usages: (ReturnType<typeof mergeStep2Usage>)[] = [];

  let { copy, usage: copyUsage } = await runCopyAgent(ai, ctx);
  usages.push(copyUsage);

  const copyLeakIssues = findCompetitorCategoryLeakViolations(copy, '', ctx);
  if (copyLeakIssues.length > 0) {
    console.log('\n=== CALL 2 retry (category leak in copy) ===', copyLeakIssues);
    const retryCopy = await runCopyAgent(ai, ctx, copyLeakIssues);
    copy = retryCopy.copy;
    usages.push(retryCopy.usage);
  }

  let { finalPrompt, usage: finalUsage } = await runFinalPromptAgent(
    ai,
    ctx,
    copy,
    productFiles
  );
  usages.push(finalUsage);

  let qaIssues = programmaticQa(ctx, copy, finalPrompt);
  let retried = false;

  if (qaIssues.length > 0) {
    retried = true;
    console.log('\n=== CALL 3 retry (programmatic QA) ===', qaIssues);
    // If leak is in copy, rewrite copy once more then regenerate prompt.
    const copyLeaks = findCompetitorCategoryLeakViolations(copy, '', ctx);
    if (copyLeaks.length > 0) {
      const retryCopy = await runCopyAgent(ai, ctx, copyLeaks);
      copy = retryCopy.copy;
      usages.push(retryCopy.usage);
    }
    const retry = await runFinalPromptAgent(ai, ctx, copy, productFiles, qaIssues);
    finalPrompt = retry.finalPrompt;
    usages.push(retry.usage);
    qaIssues = programmaticQa(ctx, copy, finalPrompt);
  }

  const usage = mergeStep2Usage(usages);

  console.log('\n=== STEP 2: FINAL PROMPT ===');
  console.log('Final prompt length:', finalPrompt.length);
  if (qaIssues.length > 0) {
    console.warn('Remaining QA issues (non-blocking):', qaIssues);
  }

  return {
    finalPrompt,
    usage,
    cost: costFromUsage(usage),
    mode: 'agent',
    creativeBridge: ctx.creativeBridge,
    whyThisWorks: ctx.creativeBridge?.whyThisWorks ?? null,
    agentDebug: {
      copy,
      visual: undefined,
      qaPass: qaIssues.length === 0,
      qaIssues,
      retried,
    },
  };
}
