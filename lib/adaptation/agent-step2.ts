import type { GoogleGenAI } from '@google/genai';
import { costFromUsage, mergeStep2Usage } from './cost';
import { generateText, generateWithProductImages, parseJson } from './gemini';
import { logoPlacementRulesBlock } from './logo-rules';
import {
  findDuplicateCopyIssues,
  findDuplicateLinesInPrompt,
  sanitizeAdaptedCopy,
} from './copy-sanitize';
import {
  copyAgentPrompt,
  qaRulesBlock,
  synthesisTaskBlock,
  visualAgentPrompt,
} from './prompt-blocks';
import type {
  AdaptationContext,
  CopyAdaptationResult,
  QaResult,
  Step2Result,
  VisualAdaptationResult,
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

async function runCopyAgent(
  ai: GoogleGenAI,
  ctx: AdaptationContext
): Promise<{ copy: CopyAdaptationResult; usage: ReturnType<typeof mergeStep2Usage> }> {
  const prompt = `${copyAgentPrompt(ctx)}

${logoPlacementRulesBlock(ctx)}
${ctx.copyLanguageInstruction}`;

  const { text, usage } = await generateText(ai, prompt, { json: true });
  const copy = normalizeCopy(parseJson<CopyAdaptationResult>(text), ctx);
  console.log('\n=== ADAPTATION AGENT: Copy ===', {
    tagline: copy.tagline,
    mainLine: copy.mainLine,
    textLineCount: copy.textLines?.length,
    iconCount: copy.featureIcons?.length,
  });
  return { copy, usage };
}

async function runVisualAgent(
  ai: GoogleGenAI,
  ctx: AdaptationContext,
  productFiles: { uri: string; mimeType?: string }[]
): Promise<{ visual: VisualAdaptationResult; usage: ReturnType<typeof mergeStep2Usage> }> {
  const prompt = `${visualAgentPrompt(ctx)}

${logoPlacementRulesBlock(ctx)}
${ctx.copyLanguageInstruction}`;

  const { text, usage } = await generateWithProductImages(ai, productFiles, prompt, {
    json: true,
  });
  const visual = parseJson<VisualAdaptationResult>(text);
  console.log('\n=== ADAPTATION AGENT: Visual ===', {
    productType: visual.productType,
    iconRowNotes: visual.iconRowNotes?.slice(0, 120),
  });
  return { visual, usage };
}

async function runSynthesis(
  ai: GoogleGenAI,
  ctx: AdaptationContext,
  copy: CopyAdaptationResult,
  visual: VisualAdaptationResult,
  qaFeedback?: string[]
): Promise<{ finalPrompt: string; usage: ReturnType<typeof mergeStep2Usage> }> {
  const feedbackBlock =
    qaFeedback && qaFeedback.length > 0
      ? `\n**FIX THESE QA ISSUES:**\n${qaFeedback.map((i) => `- ${i}`).join('\n')}\n`
      : '';

  const textGuard = `\n**TEXT RENDER GUARD:** Approved copy has exactly ${copy.textLines?.length ?? 0} lines — quote each ONCE in top-to-bottom order. Never repeat strikethrough dismissals or the punch headline.\n`;
  const prompt = synthesisTaskBlock(
    ctx,
    copy,
    visual,
    `${textGuard}${feedbackBlock ?? ''}` || undefined
  );

  const { text, usage } = await generateText(ai, prompt);
  if (!text) throw new Error('Synthesis returned empty prompt');
  return { finalPrompt: text, usage };
}

async function runQa(
  ai: GoogleGenAI,
  ctx: AdaptationContext,
  copy: CopyAdaptationResult,
  finalPrompt: string
): Promise<{ qa: QaResult; usage: ReturnType<typeof mergeStep2Usage> }> {
  const prompt = `You are a QA reviewer for adapted static-ad image prompts.

${qaRulesBlock(ctx, copy, finalPrompt)}`;

  const { text, usage } = await generateText(ai, prompt, { json: true });
  const qa = parseJson<QaResult>(text);
  console.log('\n=== ADAPTATION AGENT: QA ===', qa);
  return { qa, usage };
}

export async function runAdaptationAgent(
  ai: GoogleGenAI,
  ctx: AdaptationContext,
  productFiles: { uri: string; mimeType?: string }[]
): Promise<Step2Result> {
  console.log('\n=== STEP 2: ADAPTATION AGENT ===');

  const usages: (ReturnType<typeof mergeStep2Usage>)[] = [];

  const { copy, usage: copyUsage } = await runCopyAgent(ai, ctx);
  usages.push(copyUsage);

  const { visual, usage: visualUsage } = await runVisualAgent(ai, ctx, productFiles);
  usages.push(visualUsage);

  let { finalPrompt, usage: synthUsage } = await runSynthesis(ai, ctx, copy, visual);
  usages.push(synthUsage);

  let { qa, usage: qaUsage } = await runQa(ai, ctx, copy, finalPrompt);
  usages.push(qaUsage);

  const copyDupes = findDuplicateCopyIssues(copy);
  const promptDupes = findDuplicateLinesInPrompt(copy, finalPrompt);
  if (copyDupes.length > 0 || promptDupes.length > 0) {
    qa = { pass: false, issues: [...copyDupes, ...promptDupes, ...qa.issues] };
  }

  let retried = false;
  if (!qa.pass && qa.issues.length > 0) {
    retried = true;
    console.log('\n=== ADAPTATION AGENT: QA retry synthesis ===');
    const retry = await runSynthesis(ai, ctx, copy, visual, qa.issues);
    finalPrompt = retry.finalPrompt;
    usages.push(retry.usage);
    const retryQa = await runQa(ai, ctx, copy, finalPrompt);
    qa = retryQa.qa;
    usages.push(retryQa.usage);
    const promptDupesRetry = findDuplicateLinesInPrompt(copy, finalPrompt);
    const copyDupesRetry = findDuplicateCopyIssues(copy);
    if (copyDupesRetry.length > 0 || promptDupesRetry.length > 0) {
      qa = { pass: false, issues: [...copyDupesRetry, ...promptDupesRetry, ...qa.issues] };
    }
  }

  const usage = mergeStep2Usage(usages);

  console.log('\n=== STEP 2 (agent): FINAL PROMPT ===');
  console.log('Final prompt length:', finalPrompt.length);

  return {
    finalPrompt,
    usage,
    cost: costFromUsage(usage),
    mode: 'agent',
    creativeBridge: ctx.creativeBridge,
    whyThisWorks: ctx.creativeBridge?.whyThisWorks ?? null,
    agentDebug: {
      copy,
      visual,
      qaPass: qa.pass,
      qaIssues: qa.issues,
      retried,
    },
  };
}
