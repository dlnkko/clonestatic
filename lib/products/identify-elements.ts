import type { GoogleGenAI } from '@google/genai';
import { extractUsage, parseJson } from '@/lib/adaptation/gemini';
import type { ReferenceVisualStyle, Step2Usage } from '@/lib/adaptation/types';
import { GEMINI_MODEL } from '@/lib/gemini-model';
import type { ReferenceProductElement } from './types';

export type IdentifyReferenceElementsResult = {
  elements: ReferenceProductElement[];
  usage: Step2Usage | null;
};

/**
 * After Step 1, detect which distinct product visual elements the reference ad uses
 * (e.g. packaging + loose product) so we can attach matching images from the user's product.
 */
export async function identifyReferenceProductElements(
  ai: GoogleGenAI,
  staticAdFile: { uri: string; mimeType?: string },
  referenceVisualStyle: ReferenceVisualStyle | null,
  referenceProductPose: string
): Promise<IdentifyReferenceElementsResult> {
  const styleHint = referenceVisualStyle
    ? `oneHeroOnly: ${referenceVisualStyle.oneHeroOnly ?? false}, mainElements: ${referenceVisualStyle.oneHeroOnly ? 'one' : 'possibly multiple'}`
    : 'unknown';

  const prompt = `Analyze this REFERENCE static ad image.

Identify each DISTINCT product-related visual element shown that would need a separate source photo when cloning for another brand.

Examples of roles:
- product: the consumable/item itself (gummies, capsules, powder, device, pillowcases rolled/stacked)
- packaging: retail container shown as its own hero — bottle with label, box, pouch, jar, tube, product carton (often lower corner or beside the stack). NOT the same as loose units.
- logo: standalone brand mark (not on packaging)
- trust_badge: award seal, press badge, certification circle overlaid on product (e.g. "Award Winner", magazine logo)
- lifestyle: product in use on model (worn, held, on bed, applied) — note HOW the competitor product is used (e.g. worn on head, hand hold, resting on pillow)
- other: anything else product-related

If the ad shows an award/press/certification seal overlapping the product, you MUST include a trust_badge element.

Context from prior analysis:
- Visual style: ${styleHint}
- Product pose/arrangement notes: ${referenceProductPose.slice(0, 1500)}

If the ad shows only ONE hero product element (no separate bottle/box/pouch shot), return a single element with role "product".
If it shows loose units/items AND separate retail packaging (e.g. capsules + supplement bottle, gummies + pouch, pillowcases + product box), return TWO elements: role "product" for the units/stack, role "packaging" for the bottle/box/pouch with its layout position in the description (e.g. "supplement bottle lower right").
If packaging is visible, you MUST include role "packaging" — never merge bottle/box into "product" only.
Do not invent elements that are not visible.

Output JSON only:
{
  "elements": [
    { "role": "product" | "packaging" | "logo" | "trust_badge" | "lifestyle" | "ingredient" | "other", "description": "short visual description" }
  ]
}`;

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { fileData: { fileUri: staticAdFile.uri, mimeType: staticAdFile.mimeType || 'image/png' } },
          { text: prompt },
        ],
      },
    ],
    config: { responseMimeType: 'application/json' },
  });

  const parts = result.candidates?.[0]?.content?.parts;
  const raw = parts?.map((p) => p.text || '').join('').trim() || '';
  const parsed = parseJson<{ elements: ReferenceProductElement[] }>(raw);
  const usage = extractUsage(result);
  const elements = Array.isArray(parsed.elements) ? parsed.elements : [];
  if (elements.length === 0) {
    return {
      elements: [{ role: 'product', description: 'Main product shown in the reference ad' }],
      usage,
    };
  }
  return { elements: elements.slice(0, 4), usage };
}
