import {
  productCatalogFidelityBlock,
  textLayoutBlock,
  typographyHierarchyBlock,
} from './adaptation-rules';
import { enforceSingleHeadlineTier } from './copy-sanitize';
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
  if (/subhead|body|main|secondary|subhero/i.test(r)) return 'Subheadline';
  if (/badge|promo|offer/i.test(r)) return 'Badge';
  if (/cta|button/i.test(r)) return 'CTA';
  if (/brand-name(?!.*sub)/i.test(r)) return 'Brand name';
  if (/subtagline|sub-tagline/i.test(r)) return 'Brand sub-tagline';
  if (/spec|credential/i.test(r)) return 'Spec line';
  if (/review|testimonial/i.test(r)) return 'Review';
  if (/icon/i.test(r)) return 'Icon label';
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function typographyRenderHint(role: string): string {
  const r = role.toLowerCase();
  if (/headline|tagline|hook|punch/i.test(r)) {
    return ' — LARGEST tier, bold/display, dominant hook';
  }
  if (/subhead|body|main|secondary|subhero/i.test(r)) {
    return ' — SUBORDINATE: ~30% headline cap height, light/regular weight, own line below headline, max 2 lines — never same size/weight as headline';
  }
  if (/brand-name(?!.*sub)/i.test(r)) {
    return ' — eyebrow/small caps tier above headline if reference had brand line there';
  }
  if (/subtagline|sub-tagline/i.test(r)) {
    return ' — small supporting tier under brand name';
  }
  if (/spec|credential/i.test(r)) {
    return ' — small sans-serif, below subheadline';
  }
  if (/badge|promo|offer/i.test(r)) {
    return ' — only if listed here; do not invent award badges';
  }
  if (/review|testimonial/i.test(r)) {
    return ' — smallest footer tier';
  }
  if (/icon/i.test(r)) {
    return ' — icon label tier, 1–3 words';
  }
  return '';
}

function resolveBrandColorList(ctx: AdaptationContext): string[] {
  const colors: string[] = [...(ctx.productBrandColors ?? [])];
  const scraped = ctx.scrapedBranding?.colors;
  if (scraped && typeof scraped === 'object') {
    const primary = (scraped as { primary?: string[] }).primary;
    if (Array.isArray(primary)) colors.push(...primary);
    for (const [key, value] of Object.entries(scraped)) {
      if (typeof value === 'string') colors.push(`${key}: ${value}`);
    }
  }
  return [...new Set(colors.map((c) => c.trim()).filter(Boolean))];
}

/** Literal copy lines for the image model — render only, never write. */
export function formatLiteralCopyLines(copy: CopyAdaptationResult): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  const orderedLines = copy.textLines?.length
    ? enforceSingleHeadlineTier(copy.textLines)
    : null;

  const add = (label: string, text: string | null | undefined, roleForHint = label) => {
    const t = text?.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const hint = typographyRenderHint(roleForHint);
    lines.push(`${label}: '${escapeForPromptQuote(t)}'${hint}`);
  };

  if (orderedLines && orderedLines.length > 0) {
    for (const line of orderedLines) {
      add(roleLabel(line.role), line.text, line.role);
    }
  } else if (copy.textLines && copy.textLines.length > 0) {
    for (const line of copy.textLines) {
      add(roleLabel(line.role), line.text, line.role);
    }
  } else {
    add('Headline', copy.tagline, 'headline');
    add('Subheadline', copy.mainLine, 'subheadline');
  }

  if (copy.brandName && !copy.textLines?.some((l) => /brand/i.test(l.role))) {
    add('Brand name', copy.brandName, 'brand-name');
  }
  if (copy.brandSubtagline && !copy.textLines?.some((l) => /subtagline|sub-tagline/i.test(l.role))) {
    add('Brand sub-tagline', copy.brandSubtagline, 'brand-subtagline');
  }
  if (copy.specLine && !copy.textLines?.some((l) => /spec/i.test(l.role))) {
    add('Spec line', copy.specLine, 'spec-line');
  }
  if (copy.reviewText) add('Review', copy.reviewText, 'review');
  if (copy.reviewNumericClaims) add('Review stats', copy.reviewNumericClaims, 'review');

  if (copy.featureIcons?.length) {
    copy.featureIcons.forEach((ic, i) => {
      add(`Icon ${i + 1} label`, ic.label, 'icon-label');
    });
  }

  return lines;
}

function productFidelityLine(ctx: AdaptationContext, visual: VisualAdaptationResult): string {
  const name = ctx.productName?.trim() || visual.productType?.trim() || 'the product';
  const brandColors = resolveBrandColorList(ctx);
  const colorClause = brandColors.length
    ? ` Packaging colors must match catalog (${brandColors.slice(0, 5).join(', ')}) — do NOT lighten, recolor, or substitute competitor hues.`
    : ' Packaging colors must match attached catalog photos exactly — do NOT lighten, recolor, or invent new palette.';

  if (ctx.hasIllustrativeVisual) {
    return `Product (${name}): logo, label text, and packaging colors from catalog photos.${colorClause} Re-angle and re-scale in layout; keep illustrated/stylized body elements in reference medium — do not convert to hyperreal stock photography.`;
  }

  return `Product (${name}): hyperrealistic fidelity from attached catalog photos — exact container shape, label layout, logo, and packaging colors.${colorClause} Full freedom to change pose, angle, position, scale, overlap, lighting, and surface texture/finish to match the reference ad (matte/gloss, soft folds, sheen, condensation). FORBIDDEN: redesigning the label, changing can/bottle color, or inventing new graphics not on the catalog photo.`;
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
  if (ctx.referenceShowsPackaging) {
    return 'Visual medium: clean photographic static product ad — hyperreal packaging render from catalog photos.';
  }
  return 'Visual medium: clean photographic static ad.';
}

function sanitizeVisualForRender(
  visual: VisualAdaptationResult,
  copy: CopyAdaptationResult,
  ctx: AdaptationContext
): VisualAdaptationResult {
  const badgeInCopy = copy.textLines?.find((l) => /badge/i.test(l.role));
  const hasTrustBadgeImage = ctx.matchedProductVisuals.some((m) => m.role === 'trust_badge');

  let trustBadgeNotes = visual.trustBadgeNotes?.trim() ?? '';
  if (!badgeInCopy && !hasTrustBadgeImage) {
    trustBadgeNotes = '';
  } else if (badgeInCopy && trustBadgeNotes) {
    trustBadgeNotes = trustBadgeNotes
      .replace(/\b(?:reading|text)\s+['"][^'"]+['"]/gi, '')
      .replace(/\bMELATONIN\b[^.]*\.?/gi, '')
      .trim();
    if (trustBadgeNotes) {
      trustBadgeNotes = `Trust badge placement only — render approved Badge copy line exactly: '${badgeInCopy.text}'. ${trustBadgeNotes}`;
    }
  }

  return {
    ...visual,
    trustBadgeNotes: trustBadgeNotes || undefined,
  };
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
  const brandColors = resolveBrandColorList(ctx);
  const colorNote =
    brandColors.length > 0
      ? ` Use product brand colors for background/accents (${brandColors.slice(0, 5).join(', ')}) — not competitor reference hues.`
      : ' Use user product brand colors for background/accents — not competitor reference hues.';
  if (branding) return `${branding}${colorNote}`;
  return `Background and color mood matching reference layout.${colorNote}`;
}

function productForbiddensBlock(ctx: AdaptationContext): string {
  const trustNote = ctx.referenceTrustBadge.present
    ? ' Use only the user trust_badge image if provided.'
    : ' Do not invent award seals, "medically vetted", or press badges.';
  return `**PRODUCT RENDER FORBIDDENS:**
- Do NOT change packaging color vs catalog (e.g. dark navy can → light blue)
- Do NOT redesign label layout, typography on pack, or add flavor text not on catalog
- Do NOT substitute competitor product shape${trustNote}
- OK: adapt surface texture/material finish to match reference ad (matte pouch feel, glossy highlight, soft crumple, condensation)
- Reference ad = layout zones + texture mood; catalog photos = brand truth (colors, label, shape)`;
}

function pricingLine(ctx: AdaptationContext): string | null {
  if (ctx.allowedPrice) {
    return `Price (only if shown): '${escapeForPromptQuote(ctx.allowedPrice)}'.`;
  }
  return 'Do not show price amounts unless listed in the copy block above.';
}

/**
 * Compact Kie image prompt — copy pre-resolved, critical layout/typography rules inlined.
 * Built programmatically from copy + visual agents (no synthesis LLM).
 */
export function buildCompactImagePrompt(
  ctx: AdaptationContext,
  copy: CopyAdaptationResult,
  visual: VisualAdaptationResult,
  qaFeedback?: string[]
): string {
  const sanitizedCopy: CopyAdaptationResult = {
    ...copy,
    textLines: copy.textLines?.length ? enforceSingleHeadlineTier(copy.textLines) : copy.textLines,
  };
  const sanitizedVisual = sanitizeVisualForRender(visual, sanitizedCopy, ctx);
  const copyLines = formatLiteralCopyLines(sanitizedCopy);
  const sections = [
    `Create a static ad. ${backgroundLine(ctx, sanitizedVisual)}`,
    productCatalogFidelityBlock(ctx),
    productFidelityLine(ctx, sanitizedVisual),
    productForbiddensBlock(ctx),
    logoLine(ctx),
    copyLines.length
      ? `Text — render each line on its OWN visual row exactly as given (do not merge headline+subheadline, do not edit or rewrite):\n${copyLines.map((l) => `- ${l}`).join('\n')}`
      : null,
    textLayoutBlock(ctx, sanitizedCopy),
    typographyHierarchyBlock(ctx),
    `Layout: ${layoutLine(sanitizedVisual)}`,
    visualMediumLine(ctx, sanitizedVisual),
    pricingLine(ctx),
    qaFeedback?.length
      ? `QA fixes (must apply):\n${qaFeedback.map((i) => `- ${i}`).join('\n')}`
      : null,
  ].filter(Boolean);

  return sections.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}
