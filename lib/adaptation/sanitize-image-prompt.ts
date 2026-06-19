const MAX_KIE_PROMPT_CHARS = 1100;

/**
 * Trim synthesis output before Kie — collapse noise, cap length, preserve quoted copy.
 */
export function sanitizeImagePromptForKie(prompt: string): string {
  let p = prompt.trim();

  p = p.replace(/^\*\*[^*]+\*\*\s*/gm, '');
  p = p.replace(/\n{3,}/g, '\n\n');
  p = p.replace(/\s{2,}/g, ' ').trim();

  if (p.length <= MAX_KIE_PROMPT_CHARS) return p;

  const quoted = [...p.matchAll(/'[^']{3,80}'/g)].map((m) => m[0]);
  const copyBlock = quoted.length ? `Copy (verbatim): ${quoted.join('; ')}` : '';
  const head = p.slice(0, 500).trim();
  const merged = copyBlock ? `${head}\n${copyBlock}` : head;
  return merged.slice(0, MAX_KIE_PROMPT_CHARS).trim();
}
