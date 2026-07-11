import type { GoogleGenAI } from '@google/genai';
import { costFromUsage, mergeStep2Usage } from './cost';
import { generateText, generateWithProductImages, parseJson } from './gemini';
import {
  findDuplicateCopyIssues,
  findDuplicateLinesInPrompt,
  sanitizeAdaptedCopy,
} from './copy-sanitize';
import { sanitizeImagePromptForKie } from './sanitize-image-prompt';
import { copyAgentPrompt } from './prompt-blocks';
import { buildCall3FinalPrompt } from './old-prompts';
import { findCatalogContainerViolations } from '@/lib/products/catalog-container';
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
  ctx: AdaptationContext
): Promise<{ copy: CopyAdaptationResult; usage: ReturnType<typeof mergeStep2Usage> }> {
  const prompt = copyAgentPrompt(ctx);
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
  ];
  if (ctx.referenceHasPriceVisual && ctx.allowedPrice) {
    if (!finalPrompt.includes(ctx.allowedPrice)) {
      issues.push(`Missing allowed price ${ctx.allowedPrice}`);
    }
  } else if (/\$\d|price badge|price sticker/i.test(finalPrompt)) {
    issues.push('Reference had no price badge — remove dollar amounts from prompt');
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

  const { copy, usage: copyUsage } = await runCopyAgent(ai, ctx);
  usages.push(copyUsage);

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
