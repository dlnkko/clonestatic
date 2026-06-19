import type { ReferenceVisualStyle } from '@/lib/adaptation/types';

export type AdVisualMode = 'design' | 'realistic';

const ILLUSTRATIVE_MEDIA = new Set([
  'illustration',
  'diagram',
  '3d-render',
  'mixed',
  'product-graphic-only',
]);

export function isIllustrativeVisualStyle(
  vs: ReferenceVisualStyle | null | undefined
): boolean {
  if (!vs) return false;
  return (
    vs.hasIllustrationOrDiagram === true ||
    ILLUSTRATIVE_MEDIA.has(vs.visualMedium ?? '')
  );
}

/** Real photographic model — not illustrated/stylized anatomy or mixed graphic layouts. */
export function effectiveHasPersonInReference(
  vs: ReferenceVisualStyle | null | undefined
): boolean {
  if (!vs?.hasPerson) return false;
  if (isIllustrativeVisualStyle(vs)) return false;
  return vs.visualMedium === 'photo';
}

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
    /stylized/i,
    /animated/i,
    /soft[\s-]render/i,
    /digital\s*illustration/i,
    /educational\s*graphic/i,
    /stylized\s*graphic/i,
    /3d\s*render/i,
  ];
  if (designSignals.some((re) => re.test(promptLower))) return 'design';

  if (!vs) return 'design';

  if (isIllustrativeVisualStyle(vs)) return 'design';

  const dt = vs.designType?.toLowerCase() ?? '';
  if (dt === 'illustration-led' || dt === 'diagram-led' || dt === 'graphic-product-only') {
    return 'design';
  }

  if (effectiveHasPersonInReference(vs) || vs.hasEnvironment) return 'realistic';

  if (dt === 'has-person' || dt === 'has-environment' || dt === 'has-person-or-environment') {
    return 'realistic';
  }

  return 'design';
}

export function adVisualModeLabel(mode: AdVisualMode): string {
  return mode === 'design' ? 'Design (Nano Banana Pro)' : 'Realistic (GPT Image 2)';
}
