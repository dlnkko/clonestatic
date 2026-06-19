import { enforceSingleHeadlineTier } from './copy-sanitize';
import type { AdaptationContext, CopyAdaptationResult, VisualAdaptationResult } from './types';

const MAX_LAYOUT_CHARS = 320;
const MAX_FIELD_CHARS = 100;
const MAX_QA_ISSUES = 2;
const MAX_QA_ISSUE_CHARS = 72;

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

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function roleLabel(role: string): string {
  const r = role.toLowerCase();
  if (/headline|tagline|hook|punch/i.test(r)) return 'Headline';
  if (/subhead|body|main|secondary|subhero/i.test(r)) return 'Subheadline';
  if (/eyebrow|partnership/i.test(r)) return 'Eyebrow';
  if (/badge|promo|offer/i.test(r)) return 'Badge';
  if (/cta|button/i.test(r)) return 'CTA';
  if (/brand-name(?!.*sub)/i.test(r)) return 'Brand';
  if (/subtagline|sub-tagline/i.test(r)) return 'Brand sub';
  if (/spec|credential/i.test(r)) return 'Spec';
  if (/review|testimonial/i.test(r)) return 'Review';
  if (/icon/i.test(r)) return 'Icon';
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Short tier tag — hierarchy without prose. */
function tierTag(role: string): string {
  const r = role.toLowerCase();
  if (/headline|tagline|hook|punch/i.test(r)) return '[XL]';
  if (/subhead|body|main|secondary|subhero/i.test(r)) return '[sm ~30%]';
  if (/eyebrow|partnership/i.test(r)) return '[xs]';
  if (/badge|promo|offer/i.test(r)) return '[xs]';
  if (/brand-name(?!.*sub)/i.test(r)) return '[xs]';
  if (/subtagline|sub-tagline/i.test(r)) return '[xs]';
  if (/spec|credential/i.test(r)) return '[xs]';
  if (/review|testimonial/i.test(r)) return '[xxs]';
  if (/icon/i.test(r)) return '[xs]';
  if (/cta|button/i.test(r)) return '[sm]';
  return '[sm]';
}

function resolveBrandColorList(ctx: AdaptationContext): string[] {
  const colors: string[] = [...(ctx.productBrandColors ?? [])];
  const scraped = ctx.scrapedBranding?.colors;
  if (scraped && typeof scraped === 'object') {
    const primary = (scraped as { primary?: string[] }).primary;
    if (Array.isArray(primary)) colors.push(...primary);
    for (const value of Object.values(scraped)) {
      if (typeof value === 'string') colors.push(value);
    }
  }
  return [...new Set(colors.map((c) => c.trim()).filter(Boolean))];
}

/** Literal copy — one row per line, tier tag only. */
export function formatLiteralCopyLines(copy: CopyAdaptationResult): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  const orderedLines = copy.textLines?.length
    ? enforceSingleHeadlineTier(copy.textLines)
    : null;

  const add = (label: string, text: string | null | undefined, roleForHint: string) => {
    const t = text?.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(`${label} ${tierTag(roleForHint)}: '${escapeForPromptQuote(t)}'`);
  };

  if (orderedLines?.length) {
    for (const line of orderedLines) add(roleLabel(line.role), line.text, line.role);
  } else if (copy.textLines?.length) {
    for (const line of copy.textLines) add(roleLabel(line.role), line.text, line.role);
  } else {
    add('Headline', copy.tagline, 'headline');
    add('Subheadline', copy.mainLine, 'subheadline');
  }

  if (copy.brandName && !copy.textLines?.some((l) => /brand/i.test(l.role))) {
    add('Brand', copy.brandName, 'brand-name');
  }
  if (copy.reviewText) add('Review', copy.reviewText, 'review');
  if (copy.featureIcons?.length) {
    copy.featureIcons.forEach((ic, i) => add(`Icon ${i + 1}`, ic.label, 'icon-label'));
  }

  return lines;
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
  } else if (badgeInCopy) {
    trustBadgeNotes = truncate(
      trustBadgeNotes.replace(/\b(?:reading|text)\s+['"][^'"]+['"]/gi, '').trim(),
      MAX_FIELD_CHARS
    );
  }
  return { ...visual, trustBadgeNotes: trustBadgeNotes || undefined };
}

function compactSceneLine(ctx: AdaptationContext, visual: VisualAdaptationResult): string {
  const branding = truncate(stripUrlsAndFilenames(visual.brandingNotes ?? ''), MAX_FIELD_CHARS);
  const colors = resolveBrandColorList(ctx).slice(0, 4).join(', ');
  const medium = ctx.hasIllustrativeVisual
    ? 'illustrated/stylized'
    : ctx.hasPersonInReference
      ? 'photo candid'
      : 'photo product';
  const bg = branding || 'match reference mood';
  return `Static ${medium} ad. BG: ${bg}${colors ? `; brand palette ${colors}` : ''}.`;
}

function compactProductLine(ctx: AdaptationContext, visual: VisualAdaptationResult): string {
  const name = ctx.productName?.trim() || visual.productType?.trim() || 'product';
  const units = ctx.referenceProductUnits?.unitCount ?? 1;
  const catalogCount = ctx.matchedProductVisuals.filter(
    (m) => m.role === 'product' || m.role === 'packaging'
  ).length;
  const unitNote =
    units > 1 ? ` Show ${Math.min(units, Math.max(catalogCount, 1))} catalog unit(s), re-posed.` : '';
  return `Product "${name}": catalog colors/label/logo/shape exact; free pose/angle/scale/light/texture.${unitNote} No recolor, no label redesign, no fake badges.`;
}

function compactLogoLine(ctx: AdaptationContext): string | null {
  if (!ctx.matchedProductVisuals.some((m) => m.role === 'logo')) return null;
  return 'Logo: reproduce attached mark in reference logo zone.';
}

function compactTypeLine(ctx: AdaptationContext): string {
  const align = ctx.referenceTextLayout?.alignment ?? 'center';
  const stack = ctx.referenceTextLayout?.stackDirection ?? 'vertical';
  return `Type: ${align} ${stack} stack; one [XL] headline only; [sm ~30%] subhead light below; own row each — no merge/edit.`;
}

function compactLayoutLine(visual: VisualAdaptationResult): string {
  const parts = [
    visual.compositionRules,
    visual.poseAndArrangementParagraph,
    visual.peopleAndSceneRules,
    visual.iconRowNotes,
    visual.trustBadgeNotes,
  ]
    .map((p) => truncate(stripUrlsAndFilenames(p ?? ''), MAX_FIELD_CHARS))
    .filter(Boolean);
  const joined = parts.join(' | ') || 'match reference zones and product row';
  return `Layout: ${truncate(joined, MAX_LAYOUT_CHARS)}`;
}

function compactQaLine(qaFeedback?: string[]): string | null {
  if (!qaFeedback?.length) return null;
  const items = qaFeedback
    .slice(0, MAX_QA_ISSUES)
    .map((i) => truncate(i, MAX_QA_ISSUE_CHARS));
  return `Fix: ${items.join('; ')}`;
}

function compactPriceLine(ctx: AdaptationContext): string | null {
  if (!ctx.allowedPrice) return null;
  return `Price if shown: '${escapeForPromptQuote(ctx.allowedPrice)}'`;
}

/**
 * Brief Kie prompt — all critical rules, minimal prose. Render rules appended separately via Kie suffix.
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
    compactSceneLine(ctx, sanitizedVisual),
    compactProductLine(ctx, sanitizedVisual),
    compactLogoLine(ctx),
    copyLines.length ? `Copy:\n${copyLines.map((l) => `- ${l}`).join('\n')}` : null,
    compactTypeLine(ctx),
    compactLayoutLine(sanitizedVisual),
    compactPriceLine(ctx),
    compactQaLine(qaFeedback),
  ].filter(Boolean);

  return sections.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
