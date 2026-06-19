import type { AdaptationContext, CopyAdaptationResult, VisualAdaptationResult } from './types';

function escapeForPromptQuote(text: string): string {
  return text.replace(/'/g, '’').trim();
}

function stripUrlsAndFilenames(text: string): string {
  return text
    .replace(/https?:\/\/[^\s)\]"']+/gi, '')
    .replace(/\b[\w-]+\.(png|jpg|jpeg|webp|gif)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function roleLabel(role: string): string {
  const r = role.toLowerCase();
  if (/headline|tagline|hook|punch/i.test(r)) return 'Headline';
  if (/subhead|body|main|secondary/i.test(r)) return 'Subheadline';
  if (/badge|promo|offer/i.test(r)) return 'Badge';
  if (/cta|button/i.test(r)) return 'CTA';
  if (/brand-name(?!.*sub)/i.test(r)) return 'Brand name';
  if (/subtagline|sub-tagline/i.test(r)) return 'Brand sub-tagline';
  if (/spec|credential/i.test(r)) return 'Spec line';
  if (/review|testimonial/i.test(r)) return 'Review';
  if (/icon/i.test(r)) return 'Icon label';
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Literal copy lines for the image model — render only, never write. */
export function formatLiteralCopyLines(copy: CopyAdaptationResult): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  const add = (label: string, text: string | null | undefined) => {
    const t = text?.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(`${label}: '${escapeForPromptQuote(t)}'`);
  };

  if (copy.textLines && copy.textLines.length > 0) {
    for (const line of copy.textLines) {
      add(roleLabel(line.role), line.text);
    }
  } else {
    add('Headline', copy.tagline);
    add('Subheadline', copy.mainLine);
  }

  if (copy.brandName && !copy.textLines?.some((l) => /brand/i.test(l.role))) {
    add('Brand name', copy.brandName);
  }
  if (copy.brandSubtagline && !copy.textLines?.some((l) => /subtagline|sub-tagline/i.test(l.role))) {
    add('Brand sub-tagline', copy.brandSubtagline);
  }
  if (copy.specLine && !copy.textLines?.some((l) => /spec/i.test(l.role))) {
    add('Spec line', copy.specLine);
  }
  if (copy.reviewText) add('Review', copy.reviewText);
  if (copy.reviewNumericClaims) add('Review stats', copy.reviewNumericClaims);

  if (copy.featureIcons?.length) {
    copy.featureIcons.forEach((ic, i) => {
      add(`Icon ${i + 1} label`, ic.label);
    });
  }

  return lines;
}

function productFidelityLine(ctx: AdaptationContext, visual: VisualAdaptationResult): string {
  const name = ctx.productName?.trim() || visual.productType?.trim() || 'the product';
  if (ctx.hasIllustrativeVisual) {
    return `Product (${name}): packaging colors, logo, and label text must match attached catalog photos exactly. Re-angle and re-scale the product graphic in the layout; keep illustrated/stylized body elements in the reference medium — do not convert to hyperreal stock photography.`;
  }
  return `Product (${name}): hyperrealistic fidelity from attached catalog photos — exact packaging colors, logo, and label text. Full freedom to change pose, angle, position, scale, overlap, and lighting to match the layout below; do not copy the original catalog photo pose.`;
}

function logoLine(ctx: AdaptationContext): string | null {
  const logoMatch = ctx.matchedProductVisuals.find((m) => m.role === 'logo');
  if (!logoMatch) return null;
  const desc = stripUrlsAndFilenames(logoMatch.description);
  const short = desc.length > 120 ? `${desc.slice(0, 117)}…` : desc;
  return `Logo: ${short || 'reproduce the attached brand logo exactly in the standalone logo zone — same mark, colors, and proportions.'}`;
}

function visualMediumLine(ctx: AdaptationContext, visual: VisualAdaptationResult): string {
  const notes = stripUrlsAndFilenames(visual.visualMediumNotes ?? '');
  if (notes) return notes;
  if (ctx.hasIllustrativeVisual) {
    return `Visual medium: ${ctx.referenceVisualStyle?.visualMedium ?? 'illustration/diagram'} — match reference style, not stock lifestyle photography.`;
  }
  if (ctx.hasPersonInReference) {
    return 'Visual medium: real photographic ad — candid smartphone-quality lighting, match reference framing.';
  }
  return 'Visual medium: clean photographic static ad.';
}

function layoutLine(visual: VisualAdaptationResult): string {
  const parts = [
    visual.compositionRules,
    visual.poseAndArrangementParagraph,
    visual.peopleAndSceneRules,
    visual.iconRowNotes,
    visual.trustBadgeNotes,
  ]
    .map((p) => stripUrlsAndFilenames(p ?? ''))
    .filter(Boolean);
  return parts.join(' ') || 'Match reference ad layout zones, text placement, and product row composition.';
}

function backgroundLine(ctx: AdaptationContext, visual: VisualAdaptationResult): string {
  const branding = stripUrlsAndFilenames(visual.brandingNotes ?? '');
  if (branding) return branding;
  const colors = ctx.scrapedBranding
    ? ((ctx.scrapedBranding.colors as { primary?: string[] } | undefined)?.primary ??
      (ctx.scrapedBranding.colors as string[] | undefined))
    : null;
  if (Array.isArray(colors) && colors.length) {
    return `Background and accents using product brand colors (${colors.slice(0, 3).join(', ')}), same mood as reference layout.`;
  }
  return 'Background and color mood matching reference layout using user product brand colors.';
}

function typographyLine(ctx: AdaptationContext): string | null {
  const hint = ctx.typographyHierarchy?.sizeRatioHeadlineToSub;
  if (ctx.referenceTypography?.trim()) {
    const t = stripUrlsAndFilenames(ctx.referenceTypography).slice(0, 280);
    return `Typography: ${t}${hint ? ` Headline dominant; subheadline ~${hint} of headline size.` : ''}`;
  }
  if (hint) {
    return `Typography: headline largest; subheadline clearly smaller (~${hint} of headline cap height).`;
  }
  return null;
}

function pricingLine(ctx: AdaptationContext): string | null {
  if (ctx.allowedPrice) {
    return `Price (only if shown): '${escapeForPromptQuote(ctx.allowedPrice)}'.`;
  }
  return 'Do not show price amounts unless listed in the copy block above.';
}

/**
 * Compact Kie image prompt — single hierarchy, copy pre-resolved, product re-pose allowed.
 * Built programmatically from copy + visual agents (no synthesis LLM).
 */
export function buildCompactImagePrompt(
  ctx: AdaptationContext,
  copy: CopyAdaptationResult,
  visual: VisualAdaptationResult
): string {
  const copyLines = formatLiteralCopyLines(copy);
  const sections = [
    `Create a static ad. ${backgroundLine(ctx, visual)}`,
    productFidelityLine(ctx, visual),
    logoLine(ctx),
    copyLines.length
      ? `Text — render exactly as given, do not edit or rewrite:\n${copyLines.map((l) => `- ${l}`).join('\n')}`
      : null,
    `Layout: ${layoutLine(visual)}`,
    typographyLine(ctx),
    visualMediumLine(ctx, visual),
    pricingLine(ctx),
  ].filter(Boolean);

  return sections.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}
