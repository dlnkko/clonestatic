/** User-facing generation failure — never expose provider names. */
export const GENERATION_SERVER_ERROR =
  'Server error. Please try again shortly.';

/** Scrub provider names from any error before showing/storing to users. */
export function toUserFacingGenerationError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (!raw.trim()) return GENERATION_SERVER_ERROR;
  if (/kie|nano.?banana|gpt.?image|api\.kie|task failed|timed out|internal error/i.test(raw)) {
    return GENERATION_SERVER_ERROR;
  }
  if (/no valid product image|missing product/i.test(raw)) {
    return raw;
  }
  // Always hide opaque upstream failures from end users.
  if (/server|generation failed|please try again/i.test(raw) && !/kie/i.test(raw)) {
    return raw.includes('Server error') ? raw : GENERATION_SERVER_ERROR;
  }
  return GENERATION_SERVER_ERROR;
}
