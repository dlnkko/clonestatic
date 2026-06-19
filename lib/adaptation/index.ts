import type { GoogleGenAI } from '@google/genai';
import { runAdaptationAgent } from './agent-step2';
import {
  isAdaptationAgentEnabled,
  shouldFallbackToLegacyOnAgentError,
} from './config';
import {
  buildAdaptationContext,
  defaultReferenceLogoAnalysis,
  parseReferenceLogoPlacement,
  type BuildContextInput,
} from './context';
import { runLegacyStep2 } from './legacy-step2';
import type { AdaptationContext, ClonePipelineCost, Step2Result } from './types';

export {
  buildAdaptationContext,
  defaultReferenceLogoAnalysis,
  parseReferenceLogoPlacement,
  type BuildContextInput,
};
export {
  buildFinalPromptGeneration,
  getStaticAdAnalysisPrompt,
} from './old-prompts';
export { isAdaptationAgentEnabled, shouldFallbackToLegacyOnAgentError };
export {
  buildClonePipelineCost,
  costFromUsage,
  GEMINI_35_FLASH_INPUT_PER_MILLION_USD,
  GEMINI_35_FLASH_OUTPUT_PER_MILLION_USD,
  GEMINI_PRICING_DOC_URL,
  mergeStep2Usage,
  usageFromMetadata,
} from './cost';
export type { AdaptationContext, ClonePipelineCost, Step2Result };

export async function runStep2Adaptation(
  ai: GoogleGenAI,
  contextInput: BuildContextInput,
  productFiles: { uri: string; mimeType?: string }[]
): Promise<Step2Result> {
  const ctx = buildAdaptationContext(contextInput);
  const files =
    productFiles.length > 0 ? productFiles : [{ uri: '', mimeType: 'image/png' }];

  if (!isAdaptationAgentEnabled()) {
    console.log('Step 2 mode: legacy (USE_ADAPTATION_AGENT=false)');
    return runLegacyStep2(ai, ctx, files[0]);
  }

  console.log('Step 2 mode: adaptation agent', { productImageCount: files.length });
  try {
    return await runAdaptationAgent(ai, ctx, files);
  } catch (agentError) {
    console.error('Adaptation agent failed:', agentError);
    if (!shouldFallbackToLegacyOnAgentError()) {
      throw agentError;
    }
    console.log('Falling back to legacy Step 2...');
    return runLegacyStep2(ai, ctx, files[0]);
  }
}
