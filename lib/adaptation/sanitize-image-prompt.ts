const MAX_KIE_PROMPT_CHARS = 1100;

/**
 * Trim synthesis output before Kie — collapse noise, cap length, preserve quoted copy.
 * When client guidelines exist, keep them at the head so truncation cannot drop them.
 */
export function sanitizeImagePromptForKie(
  prompt: string,
  clientGuidelines?: string | null
): string {
  let p = prompt.trim();

  p = p.replace(/^\*\*[^*]+\*\*\s*/gm, '');
  p = p.replace(/\n{3,}/g, '\n\n');
  p = p.replace(/\s{2,}/g, ' ').trim();

  const g = typeof clientGuidelines === 'string' ? clientGuidelines.trim() : '';
  const brief = g
    ? `CLIENT GUIDELINES (apply on cloned ad — size/position/scene overrides): ${g.slice(0, 220)}\n`
    : '';

  const combined = `${brief}${p}`.trim();
  if (combined.length <= MAX_KIE_PROMPT_CHARS) return combined;

  const quoted = [...p.matchAll(/'[^']{3,80}'/g)].map((m) => m[0]);
  const copyBlock = quoted.length ? `Copy (verbatim): ${quoted.join('; ')}` : '';
  const bodyBudget = Math.max(280, MAX_KIE_PROMPT_CHARS - brief.length - (copyBlock ? copyBlock.length + 1 : 0));
  const head = p.slice(0, bodyBudget).trim();
  const merged = [brief.trim(), head, copyBlock].filter(Boolean).join('\n');
  return merged.slice(0, MAX_KIE_PROMPT_CHARS).trim();
}
