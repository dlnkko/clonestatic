import type { GoogleGenAI } from '@google/genai';
import { parseJson } from '@/lib/adaptation/gemini';
import type { ReferenceVisualStyle } from '@/lib/adaptation/types';
import { GEMINI_MODEL } from '@/lib/gemini-model';
import type { ReferenceProductElement } from './types';

/**
 * After Step 1, detect which distinct product visual elements the reference ad uses
 * (e.g. packaging + loose product) so we can attach matching images from the user's product.
 */
export async function identifyReferenceProductElements(
  ai: GoogleGenAI,
  staticAdFile: { uri: string; mimeType?: string },
  referenceVisualStyle: ReferenceVisualStyle | null,
  referenceProductPose: string
): Promise<ReferenceProductElement[]> {
  const styleHint = referenceVisualStyle
    ? `oneHeroOnly: ${referenceVisualStyle.oneHeroOnly ?? false}, mainElements: ${referenceVisualStyle.oneHeroOnly ? 'one' : 'possibly multiple'}`
    : 'unknown';

  const prompt = `Analyze this REFERENCE static ad image.

Identify each DISTINCT product-related visual element shown that would need a separate source photo when cloning for another brand.

Examples of roles:
- product: the consumable/item itself (gummies, powder, device)
- packaging: box, pouch, bottle label, tub
- logo: standalone brand mark (not on packaging)
- lifestyle: product in use / hand holding
- other: anything else product-related

Context from prior analysis:
- Visual style: ${styleHint}
- Product pose/arrangement notes: ${referenceProductPose.slice(0, 1500)}

If the ad shows only ONE hero product element, return a single element with role "product".
If it shows packaging AND the product (e.g. box + gummies), return TWO elements.
Do not invent elements that are not visible.

Output JSON only:
{
  "elements": [
    { "role": "product" | "packaging" | "logo" | "lifestyle" | "ingredient" | "other", "description": "short visual description" }
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
  const elements = Array.isArray(parsed.elements) ? parsed.elements : [];
  if (elements.length === 0) {
    return [{ role: 'product', description: 'Main product shown in the reference ad' }];
  }
  return elements.slice(0, 4);
}
