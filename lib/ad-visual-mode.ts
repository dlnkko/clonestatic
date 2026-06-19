import type { ReferenceVisualStyle } from '@/lib/adaptation/types';

export type AdVisualMode = 'design' | 'realistic';

export type IllustrativeVisualOptions = {
  referenceShowsPackaging?: boolean;
  matchedProductVisuals?: { role: string }[];
};

/**
 * True only for illustration/diagram-led ads — NOT photographic product+packaging statics.
 * `mixed` with catalog packaging is treated as photo product ad (hyperreal render).
 */
export function isIllustrativeVisualStyle(
  vs: ReferenceVisualStyle | null | undefined,
  options?: IllustrativeVisualOptions
): boolean {
  if (!vs) return false;

  const referenceShowsPackaging =
    options?.referenceShowsPackaging ??
    (options?.matchedProductVisuals?.some(
      (m) => m.role === 'packaging' || m.role === 'product'
    ) ??
      false);

  const visualMedium = vs.visualMedium ?? '';
  const illustrativeOnlyMediums = ['illustration', 'diagram', '3d-render', 'product-graphic-only'];
  const photoProductStaticAd =
    referenceShowsPackaging ||
    visualMedium === 'photo' ||
    (visualMedium === 'mixed' && referenceShowsPackaging);

  if (photoProductStaticAd) return false;

  return (
    illustrativeOnlyMediums.includes(visualMedium) ||
    vs.designType === 'illustration-led' ||
    vs.designType === 'diagram-led'
  );
}

/** Real photographic model — not illustrated/stylized anatomy or mixed graphic layouts. */
export function effectiveHasPersonInReference(
  vs: ReferenceVisualStyle | null | undefined,
  options?: IllustrativeVisualOptions
): boolean {
  if (!vs?.hasPerson) return false;
  if (isIllustrativeVisualStyle(vs, options)) return false;
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
  referenceShowsPackaging?: boolean;
}): AdVisualMode {
  const {
    referenceVisualStyle: vs,
    hasReferenceFeatureRow,
    referencePrompt = '',
    referenceShowsPackaging = false,
  } = params;

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

  const illustrativeOpts = { referenceShowsPackaging };
  if (isIllustrativeVisualStyle(vs, illustrativeOpts)) return 'design';

  const dt = vs.designType?.toLowerCase() ?? '';
  if (dt === 'illustration-led' || dt === 'diagram-led' || dt === 'graphic-product-only') {
    return 'design';
  }

  if (effectiveHasPersonInReference(vs, illustrativeOpts) || vs.hasEnvironment) return 'realistic';

  if (dt === 'has-person' || dt === 'has-environment' || dt === 'has-person-or-environment') {
    return 'realistic';
  }

  return 'design';
}

export function adVisualModeLabel(mode: AdVisualMode): string {
  return mode === 'design' ? 'Design (Nano Banana Pro)' : 'Realistic (GPT Image 2)';
}
