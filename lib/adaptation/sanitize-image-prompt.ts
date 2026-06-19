/** Remove illustration/anatomy poison when this is a product-photo ad. */
const ILLUSTRATION_POISON = [
  /keep illustrated\/diagram elements stylized[^\n]*/gi,
  /do not convert to hyperreal gym photography[^\n]*/gi,
  /NOT hyperrealistic photography[^\n]*/gi,
  /sweaty skin macro[^\n]*/gi,
  /stylized anatomical[^\n]*/gi,
  /anatomical arm[^\n]*/gi,
  /educational body graphic[^\n]*/gi,
  /gym\/lifestyle shot[^\n]*/gi,
];

const MAX_KIE_PROMPT_CHARS = 1100;

/**
 * Clean synthesis output before Kie — strip wrong medium instructions, cap length, keep copy lines.
 */
export function sanitizeImagePromptForKie(
  prompt: string,
  options: { hasIllustrativeVisual: boolean }
): string {
  let p = prompt.trim();

  // Drop markdown essay headers the model sometimes echoes
  p = p.replace(/^\*\*[^*]+\*\*\s*/gm, '');
  p = p.replace(/\n{3,}/g, '\n\n');

  if (!options.hasIllustrativeVisual) {
    for (const re of ILLUSTRATION_POISON) {
      p = p.replace(re, '');
    }
  }

  p = p.replace(/\s{2,}/g, ' ').trim();

  if (p.length <= MAX_KIE_PROMPT_CHARS) return p;

  // Preserve quoted copy lines when truncating
  const quoted = [...p.matchAll(/'[^']{3,80}'/g)].map((m) => m[0]);
  const copyBlock = quoted.length
    ? `Copy (verbatim): ${quoted.join('; ')}`
  : '';

  const head = p.slice(0, 500).trim();
  const merged = copyBlock ? `${head}\n${copyBlock}` : head;
  return merged.slice(0, MAX_KIE_PROMPT_CHARS).trim();
}
