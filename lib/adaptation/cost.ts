import type { Step2Cost, Step2Usage } from './types';

const INPUT_COST_PER_MILLION = 0.5;
const OUTPUT_COST_PER_MILLION = 3.0;

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
  const inputCost = (usage.promptTokenCount / 1_000_000) * INPUT_COST_PER_MILLION;
  const outputCost =
    (usage.candidatesTokenCount / 1_000_000) * OUTPUT_COST_PER_MILLION;
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
