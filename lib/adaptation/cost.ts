import type { ClonePipelineCost, Step2Cost, Step2Usage } from './types';

/** Gemini 3.5 Flash — Standard paid tier (USD per 1M tokens). */
export const GEMINI_35_FLASH_INPUT_PER_MILLION_USD = 1.5;
export const GEMINI_35_FLASH_OUTPUT_PER_MILLION_USD = 9.0;
export const GEMINI_PRICING_DOC_URL =
  'https://ai.google.dev/gemini-api/docs/pricing';

export function usageFromMetadata(
  metadata:
    | {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      }
    | null
    | undefined
): Step2Usage | null {
  if (!metadata) return null;
  const promptTokenCount = metadata.promptTokenCount || 0;
  const candidatesTokenCount = metadata.candidatesTokenCount || 0;
  const totalTokenCount =
    metadata.totalTokenCount || promptTokenCount + candidatesTokenCount;
  return { promptTokenCount, candidatesTokenCount, totalTokenCount };
}

export function costFromUsage(usage: Step2Usage | null): Step2Cost | null {
  if (!usage) return null;
  const inputCost =
    (usage.promptTokenCount / 1_000_000) * GEMINI_35_FLASH_INPUT_PER_MILLION_USD;
  const outputCost =
    (usage.candidatesTokenCount / 1_000_000) *
    GEMINI_35_FLASH_OUTPUT_PER_MILLION_USD;
  const totalCost = inputCost + outputCost;
  return {
    inputCost,
    outputCost,
    totalCost,
    inputCostFormatted: `$${inputCost.toFixed(6)}`,
    outputCostFormatted: `$${outputCost.toFixed(6)}`,
    totalCostFormatted: `$${totalCost.toFixed(6)}`,
  };
}

export function mergeStep2Usage(usages: (Step2Usage | null)[]): Step2Usage | null {
  const valid = usages.filter(Boolean) as Step2Usage[];
  if (valid.length === 0) return null;
  return valid.reduce(
    (acc, u) => ({
      promptTokenCount: acc.promptTokenCount + u.promptTokenCount,
      candidatesTokenCount: acc.candidatesTokenCount + u.candidatesTokenCount,
      totalTokenCount: acc.totalTokenCount + u.totalTokenCount,
    }),
    { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 }
  );
}

export function buildClonePipelineCost(input: {
  model: string;
  step1Usage: Step2Usage | null;
  productMatchingUsage: Step2Usage | null;
  step2Usage: Step2Usage | null;
  step2Mode?: 'agent' | 'legacy';
}): ClonePipelineCost {
  const step1Cost = costFromUsage(input.step1Usage);
  const productMatchingCost = costFromUsage(input.productMatchingUsage);
  const step2Cost = costFromUsage(input.step2Usage);
  const totalUsage = mergeStep2Usage([
    input.step1Usage,
    input.productMatchingUsage,
    input.step2Usage,
  ]);
  const totalCost = costFromUsage(totalUsage);

  return {
    model: input.model,
    rates: {
      inputPerMillionUsd: GEMINI_35_FLASH_INPUT_PER_MILLION_USD,
      outputPerMillionUsd: GEMINI_35_FLASH_OUTPUT_PER_MILLION_USD,
      pricingUrl: GEMINI_PRICING_DOC_URL,
    },
    breakdown: {
      step1: {
        label: 'Reference ad analysis (Step 1)',
        usage: input.step1Usage,
        cost: step1Cost,
      },
      productMatching: {
        label: 'Product image classify + identify + match',
        usage: input.productMatchingUsage,
        cost: productMatchingCost,
      },
      step2: {
        label: 'Prompt adaptation (Step 2)',
        usage: input.step2Usage,
        cost: step2Cost,
        mode: input.step2Mode,
      },
    },
    total: {
      usage: totalUsage,
      cost: totalCost,
    },
    /** @deprecated Use breakdown.step1.cost — kept for existing UI */
    step1: step1Cost,
    step2: step2Cost,
    productMatching: productMatchingCost,
  };
}
