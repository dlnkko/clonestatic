import type { ReferenceVisualStyle } from '@/lib/adaptation/types';

export type AdVisualMode = 'design' | 'realistic';

export type IllustrativeVisualOptions = {
  referenceShowsPackaging?: boolean;
  matchedProductVisuals?: { role: string }[];
};

/**
 * True only for illustration/diagram-led ads.
 * Packaging/product photo statics (even if reference visualMedium is "mixed") are NOT illustrative.
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
  const illustrativeOnly = ['illustration', 'diagram', '3d-render', 'product-graphic-only'];
  const photoProductAd =
    referenceShowsPackaging ||
    visualMedium === 'photo' ||
    (visualMedium === 'mixed' && referenceShowsPackaging);

  if (photoProductAd) return false;

  return (
    illustrativeOnly.includes(visualMedium) ||
    vs.designType === 'illustration-led' ||
    vs.designType === 'diagram-led'
  );
}

export function effectiveHasPersonInReference(
  vs: ReferenceVisualStyle | null | undefined,
  options?: IllustrativeVisualOptions
): boolean {
  if (!vs?.hasPerson) return false;
  if (isIllustrativeVisualStyle(vs, options)) return false;
  // "mixed" ads (real photo person/scene + product graphic overlay) still feature a
  // real human — preserve it, don't drop the person just because graphics are present.
  return vs.visualMedium === 'photo' || vs.visualMedium === 'mixed';
}

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

  const illustrativeOptsEarly = { referenceShowsPackaging };
  // Realistic (GPT Image 2) is reserved for ads that need photoreal humans/scenes:
  //   - a real photographic PERSON (photo or mixed medium), OR
  //   - a real photographic LOCATION/lifestyle scene shot as a pure PHOTO.
  // A "mixed"/graphic/3d background WITHOUT a real person is design-focused → Nano Banana Pro.
  // This real-scene case takes priority over feature/annotation rows so a real photo is not
  // downgraded to a flat studio "design" render.
  if (vs && !isIllustrativeVisualStyle(vs, illustrativeOptsEarly)) {
    const photoOrMixed = vs.visualMedium === 'photo' || vs.visualMedium === 'mixed';
    const dt = vs.designType?.toLowerCase() ?? '';
    const realPerson = effectiveHasPersonInReference(vs, illustrativeOptsEarly);
    const realPhotoEnvironment = vs.hasEnvironment && photoOrMixed;
    const designTypeRealScene =
      photoOrMixed &&
      (dt === 'has-person' || dt === 'has-environment' || dt === 'has-person-or-environment');
    if (realPerson || realPhotoEnvironment || designTypeRealScene) return 'realistic';
  }

  if (hasReferenceFeatureRow) return 'design';

  const promptLower = referencePrompt.toLowerCase();
  const designSignals = [
    /icon\s*row/i,
    /feature\s*icons?/i,
    /badge\s*icons?/i,
    /infographic/i,
    /flat\s*(illustration|design|graphic)/i,
    /vector/i,
    /anatomical/i,
    /cutaway/i,
    /digital\s*illustration/i,
    /educational\s*graphic/i,
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

  // Real person → realistic. A real-photo environment → realistic; a graphic/mixed/3d
  // "environment" without a real person is design-focused (Nano Banana Pro).
  if (effectiveHasPersonInReference(vs, illustrativeOpts)) return 'realistic';
  if (vs.hasEnvironment && (vs.visualMedium === 'photo' || vs.visualMedium === 'mixed')) {
    return 'realistic';
  }

  if (dt === 'has-person' || dt === 'has-person-or-environment') {
    return 'realistic';
  }
  if (dt === 'has-environment' && (vs.visualMedium === 'photo' || vs.visualMedium === 'mixed')) {
    return 'realistic';
  }

  return 'design';
}

export function adVisualModeLabel(mode: AdVisualMode): string {
  return mode === 'design' ? 'Design (Nano Banana Pro)' : 'Realistic (GPT Image 2)';
}
