import type { ReferenceVisualStyle } from '@/lib/adaptation/types';

export type AdVisualMode = 'design' | 'realistic';

/**
 * Classifies reference ads for image generation routing:
 * - design → Nano Banana Pro (icons, layouts, graphic elements)
 * - realistic → GPT Image 2 image-to-image (people, lifestyle, environments)
 */
export function classifyAdVisualMode(params: {
  referenceVisualStyle: ReferenceVisualStyle | null;
  hasReferenceFeatureRow: boolean;
  referencePrompt?: string;
}): AdVisualMode {
  const { referenceVisualStyle: vs, hasReferenceFeatureRow, referencePrompt = '' } = params;

  if (hasReferenceFeatureRow) return 'design';

  const promptLower = referencePrompt.toLowerCase();
  const designSignals = [
    /icon\s*row/i,
    /feature\s*icons?/i,
    /badge\s*icons?/i,
    /infographic/i,
    /flat\s*(illustration|design|graphic)/i,
    /vector/i,
    /ui\s*elements?/i,
  ];
  if (designSignals.some((re) => re.test(promptLower))) return 'design';

  if (!vs) return 'design';

  if (vs.hasPerson || vs.hasEnvironment) return 'realistic';

  const dt = vs.designType?.toLowerCase() ?? '';
  if (dt === 'has-person' || dt === 'has-environment' || dt === 'has-person-or-environment') {
    return 'realistic';
  }
  if (dt === 'graphic-product-only') return 'design';

  return 'design';
}

export function adVisualModeLabel(mode: AdVisualMode): string {
  return mode === 'design' ? 'Design (Nano Banana Pro)' : 'Realistic (GPT Image 2)';
}
