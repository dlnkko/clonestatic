import type { ReferenceVisualStyle } from '@/lib/adaptation/types';

export type AdVisualMode = 'design' | 'realistic';

/**
 * Classifies reference ads for image generation routing:
 * - design → Nano Banana Pro (icons, layouts, illustrations, graphic elements)
 * - realistic → GPT Image 2 image-to-image (real photographic people, lifestyle)
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
    /illustration/i,
    /diagram/i,
    /anatomical/i,
    /cutaway/i,
    /stylized\s*graphic/i,
    /3d\s*render/i,
  ];
  if (designSignals.some((re) => re.test(promptLower))) return 'design';

  if (!vs) return 'design';

  if (vs.hasIllustrationOrDiagram) return 'design';

  const medium = vs.visualMedium ?? 'product-graphic-only';
  if (['illustration', 'diagram', '3d-render', 'mixed', 'product-graphic-only'].includes(medium)) {
    if (!vs.hasPerson) return 'design';
  }

  if (vs.hasPerson || vs.hasEnvironment) return 'realistic';

  const dt = vs.designType?.toLowerCase() ?? '';
  if (dt === 'illustration-led' || dt === 'diagram-led' || dt === 'graphic-product-only') {
    return 'design';
  }
  if (dt === 'has-person' || dt === 'has-environment' || dt === 'has-person-or-environment') {
    return 'realistic';
  }

  return 'design';
}

export function adVisualModeLabel(mode: AdVisualMode): string {
  return mode === 'design' ? 'Design (Nano Banana Pro)' : 'Realistic (GPT Image 2)';
}
