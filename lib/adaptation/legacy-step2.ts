import type { GoogleGenAI } from '@google/genai';
import { costFromUsage, mergeStep2Usage } from './cost';
import { generateWithProductImage } from './gemini';
import { buildFinalPromptGeneration } from './old-prompts';
import type { AdaptationContext, Step2Result } from './types';

/** Step 2 legacy — usa finalPromptGeneration completo de oldprompts.md */
export function buildLegacyAdaptationPrompt(ctx: AdaptationContext): string {
  return buildFinalPromptGeneration(ctx);
}

export async function runLegacyStep2(
  ai: GoogleGenAI,
  ctx: AdaptationContext,
  productFile: { uri: string; mimeType?: string }
): Promise<Step2Result> {
  const prompt = buildLegacyAdaptationPrompt(ctx);
  const { text, usage } = await generateWithProductImage(ai, productFile, prompt);
  if (!text) throw new Error('Legacy Step 2 returned empty prompt');

  console.log('\n=== STEP 2 (legacy): FINAL PROMPT ===');
  console.log('Final prompt length:', text.length);

  return {
    finalPrompt: text,
    usage,
    cost: costFromUsage(usage),
    mode: 'legacy',
    creativeBridge: ctx.creativeBridge,
    whyThisWorks: ctx.creativeBridge?.whyThisWorks ?? null,
  };
}
