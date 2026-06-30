import type {
  AdCopyStyle,
  CopywritingProfile,
  Line2CopyPattern,
  MarketingAngleProfile,
  MarketingFunnelStage,
  ReferenceComparisonModule,
  ReferenceCreativeDeconstruction,
  ReferenceLayoutZones,
  ReferenceTextLayout,
  ReferenceTrustBadge,
  ReferenceTypographyHierarchy,
  TypographyHierarchyLine,
  VisualMetaphorProfile,
} from './types';
import type { ReferenceProductUnitsProfile } from '@/lib/products/types';

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export type ParsedTextLine = { role: string; text: string };

export function parseHasPromoOfferLine(analysisText: string): boolean {
  const block = analysisText.match(
    /\*\*PROMO \/ OFFER LINE \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*PRICE BADGE|\*\*TRUST BADGE|\*\*ICON \/ FEATURE|\*\*SOCIAL PROOF|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
  );
  if (!block) return false;
  return /Present:\s*yes/i.test(block[1]);
}

/** True when the reference ad shows a visible price badge/sticker (not just promo % text). */
export function parseReferenceHasPriceVisual(
  analysisText: string,
  referencePrompt?: string
): boolean {
  const block = analysisText.match(
    /\*\*PRICE BADGE \/ STICKER \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*TRUST BADGE|\*\*ICON \/ FEATURE|\*\*SOCIAL PROOF|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
  );
  if (block) {
    if (/Present:\s*yes/i.test(block[1])) return true;
    if (/Present:\s*no/i.test(block[1])) return false;
  }

  const ref = (referencePrompt ?? '').toLowerCase();
  if (/\bprice\s*(sticker|badge|tag|label|bubble|circle)\b/.test(ref)) return true;
  if (/\$\d+[\d.,]*.*(sticker|badge|on product|overlapping|corner)/.test(ref)) return true;
  if (/(circular|round)\s+(white\s+)?sticker.*\$/.test(ref)) return true;
  if (/price\s+(in|on)\s+(a\s+)?(corner|bottom-right|badge)/.test(ref)) return true;

  return false;
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
  'curiosity-gap',
  'pain-agitation',
  'product-helps-you',
  'authority-credential',
  'ingredient-spec',
  'transparency-craft',
  'wordplay',
  'benefit-bullet-list',
  'other',
];

function pickField(block: string, re: RegExp): string {
  return block.match(re)?.[1]?.trim() ?? '';
}

export function parseCreativeDeconstructionBlock(
  analysisText: string
): ReferenceCreativeDeconstruction | null {
  const blockMatch = analysisText.match(
    /\*\*CREATIVE DECONSTRUCTION[^*]*\*\*\s*([\s\S]*?)(?=\*\*MARKETING ANGLE|\*\*VISUAL METAPHOR|\*\*PROMO|\*\*TRUST BADGE|\*\*ICON \/ FEATURE|\*\*SOCIAL PROOF|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
  );
  if (!blockMatch) return null;
  const block = blockMatch[1];
  const coreConcept = pickField(block, /\*\*Core concept:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i);
  if (!coreConcept) return null;

  return {
    surfaceElements: pickField(
      block,
      /\*\*Surface elements:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i
    ),
    emotionalHook: pickField(
      block,
      /\*\*Emotional hook:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i
    ),
    coreConcept,
    resolutionMechanism: pickField(
      block,
      /\*\*Resolution mechanism:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i
    ),
    targetMoment: pickField(
      block,
      /\*\*Target moment:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i
    ),
  };
}

export function parseMarketingAngleBlock(analysisText: string): MarketingAngleProfile | null {
  const blockMatch = analysisText.match(
    /\*\*MARKETING ANGLE[^*]*\*\*\s*([\s\S]*?)(?=\*\*VISUAL METAPHOR|\*\*PROMO|\*\*TRUST BADGE|\*\*ICON \/ FEATURE|\*\*SOCIAL PROOF|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
  );
  if (!blockMatch) return null;
  const block = blockMatch[1];
  const realTopic = pickField(block, /\*\*Real topic:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i);
  if (!realTopic) return null;

  const funnelRaw = pickField(block, /\*\*Funnel stage:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i).toLowerCase();
  let funnelStage: MarketingFunnelStage = 'other';
  if (/curiosity/.test(funnelRaw)) funnelStage = 'curiosity-gap';
  else if (/product-led|product led/.test(funnelRaw)) funnelStage = 'product-led';
  else if (/direct-offer|direct offer/.test(funnelRaw)) funnelStage = 'direct-offer';
  else if (/social-proof|social proof/.test(funnelRaw)) funnelStage = 'social-proof';

  const productMentioned = /Product mentioned in copy:\s*yes/i.test(block);

  return {
    realTopic,
    targetAudience: pickField(block, /\*\*Target audience:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i),
    painPoint: pickField(block, /\*\*Core pain(?:\/ tension)?:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i),
    funnelStage,
    productMentionedInCopy: productMentioned,
    headlineRhetoricalRole: pickField(
      block,
      /\*\*Headline rhetorical role:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i
    ),
    copyExtrapolationNotes: pickField(
      block,
      /\*\*Copy extrapolation notes:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i
    ),
  };
}

export function parseVisualMetaphorBlock(analysisText: string): VisualMetaphorProfile | null {
  const blockMatch = analysisText.match(
    /\*\*VISUAL METAPHOR[^*]*\*\*\s*([\s\S]*?)(?=\*\*PROMO|\*\*TRUST BADGE|\*\*ICON \/ FEATURE|\*\*SOCIAL PROOF|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
  );
  if (!blockMatch) return null;
  const block = blockMatch[1];
  const present = /Present:\s*yes/i.test(block);
  if (!present) {
    return {
      present: false,
      visualSubject: '',
      symbolicMeaning: '',
      connectionToHeadline: '',
      adaptationGuidance: '',
    };
  }
  return {
    present: true,
    visualSubject: pickField(block, /\*\*Visual subject[^:]*:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i),
    symbolicMeaning: pickField(block, /\*\*Symbolic meaning:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i),
    connectionToHeadline: pickField(
      block,
      /\*\*Connection to headline:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i
    ),
    adaptationGuidance: pickField(
      block,
      /\*\*Adaptation guidance:\*\*\s*([\s\S]+?)(?=\n-\s*\*\*|\n\*\*|$)/i
    ),
  };
}

export function parseProductMentionedInCopy(copyBlock: string): boolean | null {
  const m = copyBlock.match(/Product mentioned in reference copy:\s*(yes|no)/i);
  if (!m) return null;
  return m[1].toLowerCase() === 'yes';
}

export function parseLine2CopyPattern(raw: string | undefined): Line2CopyPattern | null {
  if (!raw?.trim()) return null;
  const n = raw.toLowerCase().replace(/\s+/g, '-');
  for (const p of LINE2_PATTERN_VALUES) {
    if (n.includes(p.replace(/-/g, '')) || n.includes(p)) return p;
  }
  if (/curiosity-gap|curiosity gap|mystery/.test(n)) return 'curiosity-gap';
  if (/pain-agitation|pain agitation/.test(n)) return 'pain-agitation';
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
  explicitPattern?: Line2CopyPattern | null,
  options?: {
    productMentionedInCopy?: boolean | null;
    funnelStage?: MarketingFunnelStage | null;
    referenceLines?: ParsedTextLine[];
  }
): { pattern: Line2CopyPattern; template: string | null; adCopyStyle: AdCopyStyle } {
  if (explicitPattern) {
    return {
      pattern: explicitPattern,
      template: templateForPattern(explicitPattern),
      adCopyStyle: adCopyStyleForPattern(explicitPattern),
    };
  }

  const text = (line2Text ?? '').trim();
  const fn = (functionOfLine2 ?? '').toLowerCase();
  const device = (linguisticDevice ?? '').toLowerCase();
  const allRefText = (options?.referenceLines ?? []).map((l) => l.text).join(' ');
  const productMentioned =
    options?.productMentionedInCopy ??
    (/\bhelps you\b/i.test(allRefText) ? true : null);

  if (
    options?.funnelStage === 'curiosity-gap' ||
    productMentioned === false ||
    (/curiosity|mystery|problem.agitation|symptom|no product/i.test(fn) &&
      !/\bhelps you\b/i.test(text))
  ) {
    if (!/\bhelps you\b/i.test(text) && !/\bhelps you\b/i.test(allRefText)) {
      if (
        /see the\s*['"]?why|nobody told you|something feels off|discover the|find out why|learn why/i.test(
          text + allRefText
        ) ||
        options?.funnelStage === 'curiosity-gap' ||
        productMentioned === false
      ) {
        return {
          pattern: 'curiosity-gap',
          template:
            "You're [situation] and [symptom list]. But nobody told you [why/the answer].",
          adCopyStyle: 'other',
        };
      }
    }
  }

  if (
    /pain.agitation|agitate|symptom list|feels off|stuck|underperform/i.test(fn) &&
    !/\bhelps you\b/i.test(text) &&
    productMentioned !== true
  ) {
    return {
      pattern: 'pain-agitation',
      template: '[Situation] + [symptom triad] + tension — no product name',
      adCopyStyle: 'other',
    };
  }

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

function adCopyStyleForPattern(pattern: Line2CopyPattern): AdCopyStyle {
  if (pattern === 'product-helps-you') return 'dtc-benefit-led';
  return 'other';
}

function templateForPattern(pattern: Line2CopyPattern): string | null {
  switch (pattern) {
    case 'curiosity-gap':
      return "You're [situation]. [Symptom]. [Symptom]. [Symptom]. But nobody told you why.";
    case 'pain-agitation':
      return '[Audience situation] + parallel symptoms — product NOT named';
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
  profile: CopywritingProfile | null,
  marketingAngle?: MarketingAngleProfile | null
): CopywritingProfile | null {
  if (!profile) return null;
  const detected = detectSubheroCopyPattern(
    profile.referenceLine2Example,
    profile.functionOfLine2,
    profile.linguisticDeviceLine2,
    profile.line2Pattern ?? null,
    {
      productMentionedInCopy:
        profile.productMentionedInCopy ?? marketingAngle?.productMentionedInCopy ?? null,
      funnelStage: marketingAngle?.funnelStage ?? null,
      referenceLines: profile.referenceAllTextLines,
    }
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

export function parseReferenceLayoutZones(block: string): ReferenceLayoutZones | null {
  if (!block?.trim()) return null;
  const header =
    pickField(block, /\*\*Header(?:\/product)? band height:\*\*\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i) ||
    pickField(block, /Header band[^:]*:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  const main =
    pickField(block, /\*\*Primary module height:\*\*\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i) ||
    pickField(block, /Main module[^:]*:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  const notes = pickField(block, /\*\*Layout zone notes:\*\*\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  if (!header && !main && !notes) return null;
  return {
    headerBandPercent: header || '~25-35% of frame',
    mainModulePercent: main || '~65-75% of frame',
    layoutNotes: notes,
  };
}

export function parseReferenceLayoutZonesFromAnalysis(analysisText: string): ReferenceLayoutZones | null {
  const block = analysisText.match(
    /\*\*LAYOUT ZONES \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*COPYWRITING|\*\*MARKETING|\*\*VISUAL METAPHOR|\*\*PROMO|\*\*TRUST BADGE|\*\*ICON \/ FEATURE|\*\*SOCIAL PROOF|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
  );
  if (!block) return null;
  return parseReferenceLayoutZones(block[1]);
}

export type ReferenceCompositionStructure =
  | 'photo-with-overlays'
  | 'vertical-split-bands'
  | 'side-by-side-panels'
  | 'flat-graphic-only'
  | 'unknown';

export function parseReferenceCompositionStructure(
  analysisText: string
): ReferenceCompositionStructure {
  const match = analysisText.match(/Composition structure:\s*\[?([^\]\n]+)\]?/i);
  const raw = match?.[1]?.toLowerCase() ?? '';
  if (/full-bleed-photo|photo-with-graphic-overlay|graphic-overlay/i.test(raw)) {
    return 'photo-with-overlays';
  }
  if (/vertical-split|split-bands|top-bottom/i.test(raw)) return 'vertical-split-bands';
  if (/side-by-side|panels/i.test(raw)) return 'side-by-side-panels';
  if (/flat-graphic|graphic-only/i.test(raw)) return 'flat-graphic-only';
  return 'unknown';
}

export function inferHasPhotoGraphicOverlay(params: {
  compositionStructure: ReferenceCompositionStructure;
  referencePrompt: string;
  referenceVisualStyle: import('./types').ReferenceVisualStyle | null;
  hasReferenceComparisonModule: boolean;
  isGraphicOnly: boolean;
  hasIllustrativeVisual: boolean;
  hasPersonInReference: boolean;
}): boolean {
  if (params.compositionStructure === 'photo-with-overlays') return true;
  if (
    params.compositionStructure === 'vertical-split-bands' ||
    params.compositionStructure === 'flat-graphic-only'
  ) {
    return false;
  }
  if (
    params.hasReferenceComparisonModule ||
    params.isGraphicOnly ||
    params.hasIllustrativeVisual
  ) {
    return false;
  }

  const vs = params.referenceVisualStyle;
  if (!vs) return false;
  const photoOrMixed = vs.visualMedium === 'photo' || vs.visualMedium === 'mixed';
  if (!photoOrMixed) return false;

  if (params.hasPersonInReference || vs.hasEnvironment) return true;

  const prompt = params.referencePrompt.toLowerCase();
  const lifestylePhoto =
    /lifestyle|bedroom|sleeping|on bed|model|person|photograph|portrait|candid|full-bleed photo|photo background|resting/i.test(
      prompt
    );
  const overlayGraphics =
    /overlay|badge|headline|typography|text box|pill-shaped|banner|alert card|ui card|callout|ingredient block|available at/i.test(
      prompt
    );
  return lifestylePhoto && (overlayGraphics || vs.visualMedium === 'mixed');
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
  const hasEnv =
    /Has (?:gym, sport setting, or )?(?:lifestyle\/home\/|location )?environment:\s*yes/i.test(
      vsText
    ) || /Has lifestyle\/home\/location environment[^:]*:\s*yes/i.test(vsText);

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

  // Only PURE non-photo mediums suppress a real person. A "mixed" ad (real photo
  // background/person + product graphic overlay + annotation callouts) is extremely
  // common in DTC ads — the photographic person is still REAL and must be preserved.
  const pureNonPhotoMedium = ['illustration', 'diagram', '3d-render', 'product-graphic-only'].includes(
    visualMedium
  );
  const photoOrMixedMedium = visualMedium === 'photo' || visualMedium === 'mixed';
  const hasPerson =
    (hasRealPhotoPerson || (legacyPerson && photoOrMixedMedium)) &&
    !pureNonPhotoMedium &&
    // For "mixed", trust the explicit "real photographic person" signal even if the ad
    // also has graphic overlays; only block when there's no real photo person at all.
    (visualMedium !== 'mixed' || hasRealPhotoPerson || legacyPerson) &&
    (hasRealPhotoPerson || !hasIllustration);

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

export function parseReferenceProductUnits(analysisText: string): ReferenceProductUnitsProfile | null {
  const block = analysisText.match(
    /\*\*PRODUCT UNITS \(REFERENCE AD\):\*\*\s*([\s\S]*?)(?=\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT:\*\*|$)/i
  );
  if (!block) return null;

  const text = block[1];
  const countMatch = text.match(/Visible unit count:\s*(\d+)/i);
  const unitCount = countMatch ? Math.min(6, Math.max(1, Number(countMatch[1]))) : 1;
  if (unitCount <= 1) return null;

  const variantMatch = text.match(
    /Same product repeated vs distinct variants:\s*(same-repeated|distinct-variants|same|distinct)/i
  );
  const distinctVariants =
    variantMatch?.[1]?.toLowerCase().includes('distinct') ||
    /distinct-variants/i.test(variantMatch?.[1] ?? '');

  const arrangeMatch = text.match(
    /Arrangement:\s*(horizontal-row|scattered|stack|pyramid|other)/i
  );
  const arrangement = (arrangeMatch?.[1]?.toLowerCase() ?? 'other') as ReferenceProductUnitsProfile['arrangement'];

  const notesMatch = text.match(/Variant notes:\s*([\s\S]+?)(?=\n-\s|\n\*\*|$)/i);
  const perSlot = [...text.matchAll(/Slot\s*(\d+):\s*([^\n]+)/gi)].map((m) => ({
    description: m[2].trim(),
  }));

  return {
    unitCount,
    distinctVariants,
    arrangement,
    variantNotes: notesMatch?.[1]?.trim(),
    slots: perSlot.length > 0 ? perSlot : undefined,
  };
}

/** Candid / iPhone photography grammar when reference has real people. */
export function parseReferencePhotoStyle(analysisText: string): string | null {
  const block = analysisText.match(
    /\*\*PHOTOGRAPHY STYLE \(REFERENCE AD\)\*\*[^*]*([\s\S]*?)(?=\*\*[A-Z][^*]*\(REFERENCE AD\)|\*\*COPYWRITING|\*\*PRODUCT POSE|\*\*REFERENCE AD PROMPT|$)/i
  );
  if (!block?.[1]) return null;
  const text = block[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-') && !/fill ONLY when/i.test(l))
    .join('\n')
    .trim();
  return text.length > 20 ? text : null;
}
