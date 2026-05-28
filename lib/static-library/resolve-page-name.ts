import { extractText, extractUsage, getGoogleGenAI, parseJson } from '@/lib/adaptation/gemini';
import { costFromUsage } from '@/lib/adaptation/cost';
import { GEMINI_MODEL } from '@/lib/gemini-model';
import type { Step2Usage } from '@/lib/adaptation/types';

export type ResolvedPageName = {
  metaPageName: string | null;
  alternateNames?: string[];
  confidence: 'high' | 'medium' | 'low';
  notes: string;
  usage: Step2Usage | null;
  costUsd: number | null;
};

type GeminiResolveJson = {
  metaPageName?: string | null;
  alternateNames?: string[];
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
};

/**
 * Use Gemini 3.5 Flash + Google Search to find the exact Facebook/Meta Ad Library advertiser page name.
 */
export async function resolveFacebookPageNameWithSearch(input: {
  brandLabel: string;
  category: string;
  attemptedName?: string;
  scrapeError?: string;
}): Promise<ResolvedPageName> {
  const ai = getGoogleGenAI();

  const prompt = `You are helping map DTC brands to their exact advertiser name on the Meta (Facebook) Ad Library in the United States.

Brand we want ads for: "${input.brandLabel}"
Product category: ${input.category}
${input.attemptedName ? `Name we tried in the API (failed): "${input.attemptedName}"` : ''}
${input.scrapeError ? `API error: ${input.scrapeError}` : ''}

Use Google Search to find how this brand appears as the official Facebook Page name in Meta Ad Library (the "Page" column when viewing their ads). This must match exactly what ScrapeCreators/Meta expects for company lookup — often the Page name differs from the marketing name (e.g. "AG1" vs "Athletic Greens", punctuation, "LLC", etc.).

Return JSON only (no markdown):
{
  "metaPageName": "exact page name string or null if truly unknown",
  "alternateNames": ["up to 3 other exact spellings seen in Ad Library"],
  "confidence": "high",
  "notes": "brief source reasoning"
}

Rules:
- metaPageName must be the Facebook Page display name, not the website domain.
- If the brand has no US Facebook ads page, return null.
- Do not include quotes inside metaPageName.
- Prefer the name shown on facebook.com/ads/library when searching the brand.`;

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: 'application/json',
    },
  });

  const usage = extractUsage(result);
  const cost = costFromUsage(usage);

  let parsed: GeminiResolveJson = {};
  try {
    parsed = parseJson<GeminiResolveJson>(extractText(result));
  } catch {
    parsed = { metaPageName: null, confidence: 'low', notes: 'Failed to parse model JSON' };
  }

  const name = parsed.metaPageName?.trim() || null;
  const alternates = (parsed.alternateNames ?? [])
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));

  return {
    metaPageName: name,
    alternateNames: alternates,
    confidence: parsed.confidence ?? 'low',
    notes: parsed.notes ?? '',
    usage,
    costUsd: cost?.totalCost ?? null,
  };
}
