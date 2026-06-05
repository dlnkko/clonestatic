import type { AdaptationContext, AdaptedTextLine, CopyAdaptationResult } from './types';

export function normCopyText(text: string): string {
  return text
    .replace(/~~/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Remove duplicate visible lines — never allow repeated headline/dismissal text. */
export function dedupeTextLines(lines: AdaptedTextLine[]): AdaptedTextLine[] {
  const seen = new Set<string>();
  const out: AdaptedTextLine[] = [];
  for (const line of lines) {
    const text = line.text?.trim();
    if (!text) continue;
    const key = normCopyText(text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ role: line.role, text });
  }
  return out;
}

function normalizeRole(role: string): string {
  const r = role.toLowerCase();
  if (/dismiss|strikethrough|cross.?out|excuse|false/i.test(r)) return 'dismissal';
  if (/headline|punch|hook|tagline|hero/i.test(r)) return 'headline';
  if (/body|main copy|subhero|paragraph|secondary|support/i.test(r)) return 'body';
  if (/cta|button|call/i.test(r)) return 'cta';
  if (/brand-name(?!.*sub)/i.test(r)) return 'brand';
  if (/subtagline|sub-tagline/i.test(r)) return 'brand-sub';
  if (/spec|credential/i.test(r)) return 'spec';
  return r;
}

/** Order adapted lines to match reference roles; one slot per reference line. */
export function alignLinesToReference(
  adapted: AdaptedTextLine[],
  reference: { role: string; text: string }[]
): AdaptedTextLine[] {
  if (reference.length === 0) return dedupeTextLines(adapted);

  const deduped = dedupeTextLines(adapted);
  const pools = new Map<string, AdaptedTextLine[]>();
  for (const line of deduped) {
    const key = normalizeRole(line.role);
    if (!pools.has(key)) pools.set(key, []);
    pools.get(key)!.push(line);
  }

  const used = new Set<string>();
  const result: AdaptedTextLine[] = [];
  let dismissalIndex = 0;

  for (const ref of reference) {
    const roleKey = normalizeRole(ref.role);
    let picked: AdaptedTextLine | undefined;

    if (roleKey === 'dismissal') {
      const pool =
        pools.get('dismissal') ??
        deduped.filter((l) => /dismiss|strikethrough/i.test(l.role));
      while (dismissalIndex < pool.length) {
        const candidate = pool[dismissalIndex++];
        const key = normCopyText(candidate.text);
        if (!used.has(key)) {
          picked = candidate;
          break;
        }
      }
    } else {
      const pool = pools.get(roleKey) ?? [];
      picked = pool.find((l) => !used.has(normCopyText(l.text)));
    }

    if (!picked) {
      picked = deduped.find((l) => !used.has(normCopyText(l.text)));
    }

    if (picked) {
      used.add(normCopyText(picked.text));
      result.push({ role: ref.role, text: picked.text });
    }
  }

  return result.length > 0 ? result : deduped;
}

function buildFallbackTextLines(raw: CopyAdaptationResult): AdaptedTextLine[] {
  return [
    ...(raw.brandName ? [{ role: 'brand-name', text: raw.brandName }] : []),
    ...(raw.brandSubtagline
      ? [{ role: 'brand-subtagline', text: raw.brandSubtagline }]
      : []),
    { role: 'headline', text: raw.tagline },
    ...(raw.specLine
      ? [{ role: 'spec-line', text: raw.specLine }]
      : raw.mainLine
        ? [{ role: 'body', text: raw.mainLine }]
        : []),
  ].filter((l) => l.text?.trim());
}

/** Detect if synthesis prompt quoted the same copy line more than once. */
export function findDuplicateLinesInPrompt(
  copy: CopyAdaptationResult,
  finalPrompt: string
): string[] {
  const issues: string[] = [];
  const lower = finalPrompt.toLowerCase();
  for (const line of copy.textLines ?? []) {
    const snippet = line.text.replace(/~~/g, '').trim().slice(0, 48);
    if (snippet.length < 8) continue;
    const needle = snippet.toLowerCase();
    const first = lower.indexOf(needle);
    if (first === -1) continue;
    const second = lower.indexOf(needle, first + needle.length);
    if (second !== -1) {
      issues.push(`Final prompt repeats line: "${snippet.slice(0, 40)}…"`);
    }
  }
  return issues;
}

export function findDuplicateCopyIssues(copy: CopyAdaptationResult): string[] {
  const lines = copy.textLines ?? [];
  const counts = new Map<string, number>();
  for (const line of lines) {
    const key = normCopyText(line.text);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const issues: string[] = [];
  for (const [text, n] of counts) {
    if (n > 1) {
      issues.push(`Duplicate visible line (${n}×): "${text.slice(0, 80)}"`);
    }
  }
  if (lines.length > 0 && copy.tagline) {
    const headlineRoles = lines.filter((l) => normalizeRole(l.role) === 'headline');
    if (
      headlineRoles.some((l) => normCopyText(l.text) === normCopyText(copy.tagline)) &&
      headlineRoles.length > 1
    ) {
      issues.push('Multiple headline-role lines with same punch word');
    }
  }
  return issues;
}

/**
 * Canonical copy for synthesis: dedupe, align to reference architecture, sync tagline/mainLine.
 */
export function sanitizeAdaptedCopy(
  raw: CopyAdaptationResult,
  ctx: AdaptationContext
): CopyAdaptationResult {
  let textLines =
    raw.textLines && raw.textLines.length > 0
      ? dedupeTextLines([...raw.textLines])
      : buildFallbackTextLines(raw);

  if (ctx.referenceTextLines.length > 0) {
    textLines = alignLinesToReference(textLines, ctx.referenceTextLines);
    textLines = dedupeTextLines(textLines);
    if (textLines.length > ctx.referenceTextLines.length) {
      textLines = textLines.slice(0, ctx.referenceTextLines.length);
    }
  } else {
    textLines = dedupeTextLines(textLines);
  }

  const headlineLine = textLines.find((l) => normalizeRole(l.role) === 'headline');
  const bodyLine = textLines.find((l) => normalizeRole(l.role) === 'body');

  const tagline = headlineLine?.text?.trim() || raw.tagline?.trim() || '';
  const mainLine = bodyLine?.text?.trim() || raw.mainLine?.trim() || '';

  const brandInLines = textLines.some((l) => normalizeRole(l.role) === 'brand');
  const specInLines = textLines.some((l) => normalizeRole(l.role) === 'spec');

  return {
    ...raw,
    tagline,
    mainLine,
    brandName: brandInLines ? null : raw.brandName,
    brandSubtagline: textLines.some((l) => normalizeRole(l.role) === 'brand-sub')
      ? null
      : raw.brandSubtagline,
    specLine: specInLines ? null : raw.specLine,
    textLines,
    featureIcons: raw.featureIcons ?? [],
  };
}

export function textArchitectureRulesBlock(ctx: AdaptationContext): string {
  const refLines = ctx.referenceTextLines;
  const refCount = refLines.length;
  const lineSpec =
    refCount > 0
      ? refLines.map((l, i) => `  ${i + 1}. [${l.role}] — one line only`).join('\n')
      : '  Match every visible line from reference analysis';

  const dismissalCount = refLines.filter((l) =>
    /dismiss|strikethrough|cross/i.test(l.role)
  ).length;

  return `**TEXT ARCHITECTURE (CRITICAL — zero duplicate lines):**
- Reference has **exactly ${refCount || 'N'}** visible text lines. Your \`textLines\` array MUST have **the same count** — each role appears **once**.
${lineSpec}
${dismissalCount > 0 ? `- **Strikethrough dismissals:** exactly **${dismissalCount}** unique dismissal lines (different text each). NEVER repeat the same dismissal phrase twice.` : ''}
- Put **every** visible string ONLY in \`textLines\` (ordered top-to-bottom). \`tagline\` = punch headline word(s) only. \`mainLine\` = body paragraph only (if reference has one). Do NOT duplicate dismissals/headline/body in multiple fields.
- **FORBIDDEN:** Repeating any line text; listing the same dismissal twice; echoing headline in both tagline and a second headline row`;
}

export function productCategoryAnchorBlock(ctx: AdaptationContext): string {
  const name = ctx.productName?.trim();
  const summary = ctx.scrapedSummary?.slice(0, 500) ?? '';
  if (!name && !summary) {
    return `**USER PRODUCT CATEGORY:** Infer from scraped data. All symptoms, metaphors, and visuals must match THAT category — not the reference competitor's world.`;
  }
  return `**USER PRODUCT (anchor everything to this — NOT reference category):**
- Product: ${name || 'see scrape'}
${summary ? `- Context: ${summary}` : ''}
- **Copy:** Translate reference *structure* but symptoms/outcomes must fit **this** product's buyers (e.g. creatine → training plateau, flat strength, gym energy — NOT libido/bedroom copy from a different niche unless this product is in that niche).
- **Visual metaphor:** Symbol must relate to **this** product's problem (e.g. deflated gym ball, slack resistance band, flat dumbbell) — clear, recognizable, on-white like reference — NOT abstract blobs, brains, or unrelated shapes.`;
}
