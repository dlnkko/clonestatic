import type {
  AdCopyStyle,
  CopywritingProfile,
  Line2CopyPattern,
  ReferenceComparisonModule,
  ReferenceTextLayout,
  ReferenceTrustBadge,
  ReferenceTypographyHierarchy,
  TypographyHierarchyLine,
} from './types';

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export type ParsedTextLine = { role: string; text: string };

export function parseHasPromoOfferLine(analysisText: string): boolean {
  const block = analysisText.match(
    /\*\*PROMO \/ OFFER LINE \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*TRUST BADGE|\*\*ICON \/ FEATURE|\*\*SOCIAL PROOF|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
  );
  if (!block) return false;
  return /Present:\s*yes/i.test(block[1]);
}

export function parseReferenceTrustBadge(analysisText: string): ReferenceTrustBadge {
  const block = analysisText.match(
    /\*\*TRUST BADGE \/ AWARD SEAL \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*ICON \/ FEATURE|\*\*SOCIAL PROOF|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
  );
  if (!block) {
    return { present: false, placement: '', description: '' };
  }
  const text = block[1];
  const present = /Present:\s*yes/i.test(text);
  const placementMatch = text.match(/Placement:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  const descMatch = text.match(/Description:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  return {
    present,
    placement: placementMatch?.[1]?.trim() ?? '',
    description: descMatch?.[1]?.trim() ?? '',
  };
}

/** Headlines and hooks from reference — must NOT be reused verbatim in adapted ads. */
export function parseVerbatimPhrasesFromCopyBlock(copyBlock: string): string[] {
  const phrases: string[] = [];
  const linesSection = copyBlock.match(
    /All text lines \(top to bottom\):\s*([\s\S]+?)(?=\n-\s*Headline|\n-\s*\*\*|$)/i
  );
  const raw = linesSection?.[1] ?? copyBlock;

  const numberedLine = /^\s*\d+\.\s*([^—–:\n]+?)\s*[—–:-]\s*(.+)$/gim;
  let m: RegExpExecArray | null;
  while ((m = numberedLine.exec(raw)) !== null) {
    const role = m[1].toLowerCase();
    const text = m[2].replace(/^["']|["']$/g, '').trim();
    if (
      text.length >= 8 &&
      /headline|tagline|hook|main\s*head|title/i.test(role)
    ) {
      phrases.push(text);
    }
  }

  const promoExact = copyBlock.match(/Exact text \(if yes\):\s*(.+)/i);
  if (promoExact) {
    const t = promoExact[1].trim();
    if (t.length >= 6 && !/none|n\/a/i.test(t)) phrases.push(t);
  }

  return [...new Set(phrases.map((p) => p.toUpperCase().trim()))].slice(0, 8);
}

/** Parse numbered text lines from Step 1 copywriting analysis. */
export function parseReferenceTextLines(copyBlock: string): ParsedTextLine[] {
  const lines: ParsedTextLine[] = [];
  const linesSection = copyBlock.match(
    /All text lines \(top to bottom\):\s*([\s\S]+?)(?=\n-\s*Headline|\n-\s*\*\*|$)/i
  );
  const raw = linesSection?.[1] ?? copyBlock;
  const numberedLine = /^\s*\d+\.\s*([^—–:\n]+?)\s*[—–:-]\s*(.+)$/gim;
  let m: RegExpExecArray | null;
  while ((m = numberedLine.exec(raw)) !== null) {
    const role = m[1].trim();
    const text = m[2].replace(/^["']|["']$/g, '').trim();
    if (text.length >= 2) lines.push({ role, text });
  }
  return lines;
}

/** Parse typography size ladder from Step 1 TYPOGRAPHY block. */
export function parseTypographyHierarchy(
  typographyText: string
): ReferenceTypographyHierarchy | null {
  if (!typographyText?.trim()) return null;

  const headlineTier =
    typographyText.match(/Headline (?:visual )?(?:weight|size tier):\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i)?.[1]?.trim() ??
    typographyText.match(/Headline size(?:\s+tier)?:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i)?.[1]?.trim() ??
    'largest — dominant headline';

  const subheadlineTier =
    typographyText.match(
      /Subheadline(?:\/sub-copy)? (?:visual )?(?:weight|size tier):\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i
    )?.[1]?.trim() ??
    typographyText.match(
      /Supporting (?:copy|line) (?:visual )?(?:weight|size tier):\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i
    )?.[1]?.trim() ??
    'clearly smaller than headline — subordinate supporting text';

  const sizeRatio =
    typographyText.match(/Size ratio headline(?:\s*to\s*sub(?:headline)?)?:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i)?.[1]?.trim() ??
    typographyText.match(/Headline-to-subheadline ratio:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i)?.[1]?.trim() ??
    null;

  const hierarchySummary =
    typographyText.match(/Text hierarchy(?: notes)?:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i)?.[1]?.trim() ??
    typographyText.match(/Hierarchy(?: summary)?:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i)?.[1]?.trim() ??
    '';

  const lines: TypographyHierarchyLine[] = [];
  const ladderSection = typographyText.match(
    /Text hierarchy ladder[^:]*:\s*([\s\S]+?)(?=\n-\s*Size ratio|\n-\s*Headline|\n\*\*|$)/i
  );
  const ladderRaw = ladderSection?.[1] ?? typographyText;
  const ladderLine = /^\s*[-•]\s*([^:]+):\s*([\s\S]+?)(?=\n\s*[-•]|\n-\s|\n\*\*|$)/gim;
  let lm: RegExpExecArray | null;
  while ((lm = ladderLine.exec(ladderRaw)) !== null) {
    const role = lm[1].trim();
    const rest = lm[2].trim();
    const sizeMatch = rest.match(/size\s*=\s*([^,]+)/i);
    const weightMatch = rest.match(/weight\s*=\s*([^,]+)/i);
    lines.push({
      role,
      sizeTier: sizeMatch?.[1]?.trim() ?? rest,
      weight: weightMatch?.[1]?.trim(),
    });
  }

  return {
    headlineTier,
    subheadlineTier,
    sizeRatioHeadlineToSub: sizeRatio,
    hierarchySummary,
    lines,
  };
}

/** Cap secondary-line word limits from reference text lines (roles), not generic defaults. */
const LINE2_PATTERN_VALUES: Line2CopyPattern[] = [
  'product-helps-you',
  'authority-credential',
  'ingredient-spec',
  'transparency-craft',
  'wordplay',
  'benefit-bullet-list',
  'other',
];

export function parseLine2CopyPattern(raw: string | undefined): Line2CopyPattern | null {
  if (!raw?.trim()) return null;
  const n = raw.toLowerCase().replace(/\s+/g, '-');
  for (const p of LINE2_PATTERN_VALUES) {
    if (n.includes(p.replace(/-/g, '')) || n.includes(p)) return p;
  }
  if (/benefit-bullet|bullet-list|comma-list|8-hrs/.test(n)) return 'benefit-bullet-list';
  if (/product-helps|helps-you|benefit-bridge|benefit bridge/.test(n)) return 'product-helps-you';
  if (/authority|credential|dermatologist|doctor/.test(n)) return 'authority-credential';
  if (/ingredient|spec/.test(n)) return 'ingredient-spec';
  if (/transparency|craft/.test(n)) return 'transparency-craft';
  if (/wordplay|pun|joke/.test(n)) return 'wordplay';
  return null;
}

export function parseAdCopyStyle(raw: string | undefined): AdCopyStyle | null {
  if (!raw?.trim()) return null;
  const n = raw.toLowerCase();
  if (/dtc|benefit-led|benefit led|pain-point|pain point|emotional hook/.test(n))
    return 'dtc-benefit-led';
  if (/authority/.test(n)) return 'authority-led';
  if (/spec/.test(n)) return 'spec-led';
  if (/promo/.test(n)) return 'promo-led';
  return 'other';
}

/** Infer subhero pattern from reference line 2 text + Step 1 labels. */
export function detectSubheroCopyPattern(
  line2Text: string | null | undefined,
  functionOfLine2?: string | null,
  linguisticDevice?: string | null,
  explicitPattern?: Line2CopyPattern | null
): { pattern: Line2CopyPattern; template: string | null; adCopyStyle: AdCopyStyle } {
  if (explicitPattern) {
    return {
      pattern: explicitPattern,
      template: templateForPattern(explicitPattern),
      adCopyStyle: explicitPattern === 'product-helps-you' ? 'dtc-benefit-led' : 'other',
    };
  }

  const text = (line2Text ?? '').trim();
  const fn = (functionOfLine2 ?? '').toLowerCase();
  const device = (linguisticDevice ?? '').toLowerCase();

  if (
    /\d+\s*hrs?\s+of\b|,?\s*no\s+\w+\s+\w+,/i.test(text) ||
    /benefit list|comma-separated benefits|bullet list/i.test(fn)
  ) {
    return {
      pattern: 'benefit-bullet-list',
      template: '[duration/amount] of [benefit], no [pain point], [outcome]',
      adCopyStyle: 'dtc-benefit-led',
    };
  }

  if (
    /\bhelps you\b|\bhelp(s)?\s+(you|your)\b|\bso you can\b|\blets you\b/i.test(text) ||
    /benefit bridge|outcome|helps.*fall|helps.*stay|helps.*wake/i.test(fn) ||
    (device.includes('straight benefit') && !/dermatologist|doctor|clinician|recommended by/i.test(text))
  ) {
    return {
      pattern: 'product-helps-you',
      template: extractHelpsYouTemplate(text),
      adCopyStyle: 'dtc-benefit-led',
    };
  }

  if (
    /dermatologist|doctor recommended|clinician|clinically proven|fda|physician|expert recommended/i.test(
      text
    ) ||
    /authority|credential|endorsement/i.test(fn)
  ) {
    return {
      pattern: 'authority-credential',
      template: '[Authority] recommended [product/credential claim]',
      adCopyStyle: 'authority-led',
    };
  }

  if (
    /every ingredient|nothing is here for marketing|earns its place|transparent/i.test(text) ||
    /transparency|craft/i.test(fn)
  ) {
    return {
      pattern: 'transparency-craft',
      template: 'Transparency / craft messaging parallel to reference',
      adCopyStyle: 'dtc-benefit-led',
    };
  }

  if (/wordplay|pun|joke|double meaning|sarcasm/i.test(device) || /wordplay|pun|joke/i.test(fn)) {
    return { pattern: 'wordplay', template: null, adCopyStyle: 'other' };
  }

  if (
    /\d+\s*(mg|g|ml|%|momme)|grade\s*\d|zero sugar|db\b/i.test(text) ||
    /spec|feature list/i.test(fn)
  ) {
    return {
      pattern: 'ingredient-spec',
      template: 'Condensed specs/credentials line',
      adCopyStyle: 'spec-led',
    };
  }

  return { pattern: 'other', template: null, adCopyStyle: 'other' };
}

function templateForPattern(pattern: Line2CopyPattern): string | null {
  switch (pattern) {
    case 'product-helps-you':
      return '[Product name] helps you [primary benefit] & [secondary benefit]';
    case 'benefit-bullet-list':
      return '[duration] of [benefit], no [pain], [outcome]';
    case 'authority-credential':
      return '[Authority] recommended [claim]';
    case 'ingredient-spec':
      return '[Material/spec]. [Grade/certification].';
    case 'transparency-craft':
      return 'Craft/transparency parallel structure';
    default:
      return null;
  }
}

function extractHelpsYouTemplate(text: string): string {
  if (!text) return '[Product] helps you [benefit] & [benefit]';
  const m = text.match(/^(.+?\bhelps you\b.+)$/i);
  if (m) {
    return m[1]
      .replace(/\b[\w']+\b/g, (w, i, s) => {
        const lower = w.toLowerCase();
        if (i < 30 && /^(magnesium|glycinate|protein|silk|creatine|[\w-]+)$/i.test(w) && s.indexOf('helps') > i)
          return '[Product]';
        if (/faster|longer|better|smoother|calmer|stronger|asleep|awake/i.test(lower)) return '[benefit]';
        return w;
      })
      .slice(0, 120);
  }
  return '[Product] helps you [primary benefit] & [secondary benefit]';
}

export function enrichCopywritingProfile(
  profile: CopywritingProfile | null
): CopywritingProfile | null {
  if (!profile) return null;
  const detected = detectSubheroCopyPattern(
    profile.referenceLine2Example,
    profile.functionOfLine2,
    profile.linguisticDeviceLine2,
    profile.line2Pattern ?? null
  );
  return {
    ...profile,
    adCopyStyle: profile.adCopyStyle ?? detected.adCopyStyle,
    line2Pattern: profile.line2Pattern ?? detected.pattern,
    line2SentenceTemplate:
      profile.line2SentenceTemplate ?? detected.template ?? profile.line2SentenceTemplate,
  };
}

export function parseReferenceTextLayout(block: string): ReferenceTextLayout | null {
  if (!block?.trim()) return null;
  const alignMatch = block.match(/Text alignment:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  const stackMatch = block.match(/Stack direction:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  const eyebrowMatch = block.match(/Eyebrow line present:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  const eyebrowStyle = block.match(/Eyebrow style:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  const heroStyle = block.match(/Hero headline style:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  const subStyle = block.match(/Subhero style:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  const notesMatch = block.match(/Layout notes:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);

  const alignRaw = (alignMatch?.[1] ?? 'center').toLowerCase();
  let alignment: ReferenceTextLayout['alignment'] = 'center';
  if (/left/.test(alignRaw)) alignment = 'left';
  else if (/right/.test(alignRaw)) alignment = 'right';
  else if (/mixed/.test(alignRaw)) alignment = 'mixed';

  const stackRaw = (stackMatch?.[1] ?? 'vertical').toLowerCase();
  const stackDirection: ReferenceTextLayout['stackDirection'] = /horizontal/.test(stackRaw)
    ? 'horizontal'
    : /mixed/.test(stackRaw)
      ? 'mixed'
      : 'vertical';

  const hasEyebrow = /yes/i.test(eyebrowMatch?.[1] ?? '');

  return {
    alignment,
    stackDirection,
    hasEyebrow,
    eyebrowStyle: eyebrowStyle?.[1]?.trim() ?? null,
    heroStyle: heroStyle?.[1]?.trim() ?? null,
    subheroStyle: subStyle?.[1]?.trim() ?? null,
    layoutNotes: notesMatch?.[1]?.trim() ?? '',
  };
}

export function parseReferenceComparisonModule(block: string): ReferenceComparisonModule {
  const present = /Present:\s*yes/i.test(block);
  if (!present) {
    return {
      present: false,
      layoutType: '',
      subjectFraming: '',
      labelStyle: '',
      transitionStyle: '',
      placement: '',
      notes: '',
    };
  }
  const pick = (re: RegExp) => block.match(re)?.[1]?.trim() ?? '';
  return {
    present: true,
    layoutType: pick(/Layout type:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i),
    subjectFraming: pick(/Subject framing:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i),
    labelStyle: pick(/Label style:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i),
    transitionStyle: pick(/Panel transition:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i),
    placement: pick(/Placement in ad:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i),
    notes: pick(/Comparison notes:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i),
  };
}

export function hasReferenceComparisonFromAnalysis(analysisText: string): boolean {
  const block = analysisText.match(
    /\*\*BEFORE \/ AFTER COMPARISON \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*COPYWRITING|\*\*PROMO|\*\*TRUST BADGE|\*\*ICON \/ FEATURE|\*\*SOCIAL PROOF|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
  );
  if (!block) return false;
  return /Present:\s*yes/i.test(block[1]);
}

export function inferSecondaryWordLimitFromReferenceLines(
  lines: ParsedTextLine[],
  fallback: number
): number {
  const secondaryRoles =
    /subheadline|sub-headline|subtagline|brand-subtagline|spec-line|spec line|supporting|body copy|main copy|slogan|description|secondary/i;
  const secondary = lines.filter((l) => secondaryRoles.test(l.role));
  if (secondary.length === 0) return fallback;
  const maxRef = Math.max(...secondary.map((l) => countWords(l.text)));
  return Math.min(fallback, Math.max(4, Math.ceil(maxRef * 1.1)));
}

export function parseReferenceVisualStyle(vsText: string): import('./types').ReferenceVisualStyle {
  const hasRealPhotoPerson = /Has real photographic person(?:\/model)?:\s*yes/i.test(vsText);
  const legacyPerson = /Has person\/character:\s*yes/i.test(vsText);
  const hasIllustration = /Has illustration(?:\/diagram\/animation)?:\s*yes/i.test(vsText);
  const hasEnv = /Has gym, sport setting, or location environment:\s*yes/i.test(vsText);

  const mediumMatch = vsText.match(
    /Visual medium:\s*(photo|illustration|diagram|3d-render|mixed|product-graphic-only)/i
  );
  const visualMedium = (mediumMatch?.[1]?.toLowerCase() ??
    'product-graphic-only') as import('./types').ReferenceVisualStyle['visualMedium'];

  const illustTypeMatch = vsText.match(/Illustration\/diagram type:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  const designMatch = vsText.match(
    /Design type:\s*(graphic-product-only|has-person|has-environment|illustration-led|diagram-led)/i
  );
  const mainElementsMatch = vsText.match(/Main elements:\s*(one-hero-only|multiple)/i);

  const hasPerson =
    hasRealPhotoPerson ||
    (legacyPerson && !hasIllustration && visualMedium === 'photo');

  let designType = designMatch?.[1]?.toLowerCase() ?? '';
  if (!designType) {
    if (hasIllustration || visualMedium === 'illustration' || visualMedium === 'diagram') {
      designType = 'illustration-led';
    } else if (hasPerson || hasEnv) {
      designType = hasPerson ? 'has-person' : 'has-environment';
    } else {
      designType = 'graphic-product-only';
    }
  }

  return {
    hasPerson,
    hasIllustrationOrDiagram:
      hasIllustration ||
      ['illustration', 'diagram', '3d-render', 'mixed'].includes(visualMedium),
    visualMedium,
    illustrationNotes: illustTypeMatch?.[1]?.trim() ?? '',
    hasEnvironment: hasEnv,
    designType,
    oneHeroOnly: mainElementsMatch ? mainElementsMatch[1].toLowerCase() === 'one-hero-only' : false,
  };
}
