import type { GoogleGenAI } from '@google/genai';
import { extractUsage, parseJson } from '@/lib/adaptation/gemini';
import type { Step2Usage } from '@/lib/adaptation/types';
import { GEMINI_MODEL } from '@/lib/gemini-model';
import type { ProductImage, ProductImageKind } from './types';

export type RefineProductImageKindsResult = {
  images: ProductImage[];
  usage: Step2Usage | null;
};

const TRUST_URL =
  /award|seal|badge|winner|certified|trust|medal|editor|beauty|authority|press|as-seen|guarantee|ribbon|honor/i;
const LOGO_URL = /(?:^|\/)(?:logo|brand-mark|wordmark|site-logo|header-logo|brand_logo|brand-logo)(?:[./_-]|$)/i;
const PACKAGING_URL = /pack|box|pouch|tub|bottle|carton|bundle/i;
const LIFESTYLE_URL = /lifestyle|in-use|model|hand-hold|wearing/i;

function heuristicKind(url: string, alt: string, index: number): ProductImageKind {
  const hay = `${url} ${alt}`.toLowerCase();
  if (TRUST_URL.test(hay) && !/(icon|favicon|sprite|arrow|chevron|social)/i.test(hay)) {
    return 'trust_badge';
  }
  if (LOGO_URL.test(hay)) return 'logo';
  if (PACKAGING_URL.test(hay)) return 'packaging';
  if (LIFESTYLE_URL.test(hay)) return 'lifestyle';
  if (index === 0) return 'product';
  return 'other';
}

export function classifyProductImagesHeuristic(images: ProductImage[]): ProductImage[] {
  return images.map((img, i) => ({
    ...img,
    kind: img.kind && img.kind !== 'other' ? img.kind : heuristicKind(img.url, img.alt || '', i),
  }));
}

/** Vision batch when heuristics found no trust badge but reference ad uses one. */
export async function refineProductImageKinds(
  ai: GoogleGenAI,
  images: ProductImage[],
  options?: { needTrustBadge?: boolean }
): Promise<RefineProductImageKindsResult> {
  const classified = classifyProductImagesHeuristic(images);
  const hasTrust = classified.some((i) => i.kind === 'trust_badge');
  if (!options?.needTrustBadge || hasTrust || images.length < 2) {
    return { images: classified, usage: null };
  }

  const catalog = classified.slice(0, 16).map((img, i) => ({
    index: i,
    url: img.url.slice(0, 160),
    alt: img.alt || '',
    kind: img.kind,
  }));

  const prompt = `Classify each product-page image for static ad generation.

Kinds:
- product: hero product shot (item, pillowcase, device, etc.)
- packaging: box, pouch, bottle with label
- logo: brand wordmark only
- trust_badge: award seal, press badge, "as seen in", certification circle, quality stamp (NOT tiny UI icons)
- lifestyle: product in use / model
- ingredient: ingredient graphic
- other: misc

Pick at most ONE trust_badge if any image is clearly an award/press/certification graphic.

Images:
${catalog.map((c) => `[${c.index}] ${c.kind} — ${c.url}${c.alt ? ` — ${c.alt}` : ''}`).join('\n')}

Output JSON: { "kinds": [{ "index": number, "kind": string }] }`;

  try {
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' },
    });
    const raw =
      result.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    const parsed = parseJson<{ kinds: { index: number; kind: string }[] }>(raw);
    const validKinds = new Set([
      'product',
      'packaging',
      'logo',
      'trust_badge',
      'lifestyle',
      'ingredient',
      'other',
    ]);
    const out = [...classified];
    for (const row of parsed.kinds || []) {
      if (row.index < 0 || row.index >= out.length) continue;
      const k = row.kind as ProductImageKind;
      if (validKinds.has(k)) out[row.index] = { ...out[row.index], kind: k };
    }
    return { images: out, usage: extractUsage(result) };
  } catch {
    return { images: classified, usage: null };
  }
}
