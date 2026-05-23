/**
 * Step 2 adaptation (restart dev server after change):
 *
 *   USE_ADAPTATION_AGENT=false  → legacy single Gemini call
 *   USE_ADAPTATION_AGENT=true   → multi-step agent (default)
 */
export function isAdaptationAgentEnabled(): boolean {
  const v = process.env.USE_ADAPTATION_AGENT?.trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no' || v === 'legacy') return false;
  return true;
}

export function shouldFallbackToLegacyOnAgentError(): boolean {
  const v = process.env.ADAPTATION_AGENT_FALLBACK_LEGACY?.trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no') return false;
  return true;
}
