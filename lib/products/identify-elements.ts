import type { GoogleGenAI } from '@google/genai';
import { extractUsage, parseJson } from '@/lib/adaptation/gemini';
import type { ReferenceLogoAnalysis, ReferenceVisualStyle, Step2Usage } from '@/lib/adaptation/types';
import { referenceNeedsStandaloneLogo } from './ensure-logo-match';
import { GEMINI_MODEL } from '@/lib/gemini-model';
import type { ReferenceProductElement, ReferenceProductUnitsProfile } from './types';

export type IdentifyReferenceElementsResult = {
  elements: ReferenceProductElement[];
  usage: Step2Usage | null;
};

const VALID_ELEMENT_ROLES = new Set([
  'product',
  'packaging',
  'logo',
  'trust_badge',
  'lifestyle',
  'ingredient',
  'other',
]);

/**
 * Parse the PRODUCT SOURCE ELEMENTS section that Step 1 now outputs, so no extra
 * Gemini call is needed. Lines look like: "- packaging | lower-right packshot zone".
 * Falls back to a single generic element when the section is missing/unparseable.
 */
export function parseReferenceElementsFromAnalysis(
  analysisText: string,
  fallback?: { referenceShowsPackagingHint?: boolean }
): ReferenceProductElement[] {
  const sectionMatch = analysisText.match(
    /\*\*PRODUCT SOURCE ELEMENTS \(REFERENCE AD\)[^\n]*\n([\s\S]*?)(?=\n\*\*[A-Z]|$)/i
  );
  const elements: ReferenceProductElement[] = [];

  if (sectionMatch) {
    const lines = sectionMatch[1].split('\n');
    for (const rawLine of lines) {
      const line = rawLine.replace(/^[-*\d.\s]+/, '').trim();
      if (!line || !line.includes('|')) continue;
      const [roleRaw, ...descParts] = line.split('|');
      const role = roleRaw.trim().toLowerCase().replace(/[^a-z_]/g, '');
      const description = descParts.join('|').trim();
      if (!VALID_ELEMENT_ROLES.has(role) || !description) continue;
      elements.push({
        role: role as ReferenceProductElement['role'],
        description,
      });
      if (elements.length >= 8) break;
    }
  }

  if (elements.length === 0) {
    return [
      {
        role: fallback?.referenceShowsPackagingHint ? 'packaging' : 'product',
        description: 'Main product shown in the reference ad',
      },
    ];
  }
  return elements;
}

/**
 * After Step 1, detect which distinct product visual elements the reference ad uses
 * (e.g. packaging + loose product) so we can attach matching images from the user's product.
 */
export async function identifyReferenceProductElements(
  ai: GoogleGenAI,
  staticAdFile: { uri: string; mimeType?: string },
  referenceVisualStyle: ReferenceVisualStyle | null,
  referenceProductPose: string,
  referenceProductUnits?: ReferenceProductUnitsProfile | null,
  referenceLogoAnalysis?: ReferenceLogoAnalysis | null
): Promise<IdentifyReferenceElementsResult> {
  const styleHint = referenceVisualStyle
    ? `oneHeroOnly: ${referenceVisualStyle.oneHeroOnly ?? false}, mainElements: ${referenceVisualStyle.oneHeroOnly ? 'one' : 'possibly multiple'}`
    : 'unknown';
  const unitsHint = referenceProductUnits
    ? `Visible product units in reference: ${referenceProductUnits.unitCount} (${referenceProductUnits.distinctVariants ? 'distinct variants/flavors/colors' : 'same SKU repeated'})`
    : 'Count visible product units/packs in the image';
  const logoHint = referenceNeedsStandaloneLogo(referenceLogoAnalysis)
    ? `\nIMPORTANT: This reference has a STANDALONE brand logo/wordmark in the layout (not only on packaging). You MUST include a separate element with role "logo" describing its placement (e.g. centered above headline).`
    : '';

  const prompt = `Analyze this REFERENCE static ad image.
${logoHint}

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
- Product units: ${unitsHint}
- Product pose/arrangement notes: ${referenceProductPose.slice(0, 1500)}

If the ad shows MULTIPLE product units or flavor/color variants (e.g. three cans in a row), describe the layout — do NOT collapse to a single element.

If the ad shows only ONE hero product element (no separate bottle/box/pouch shot), return a single element:
- role **packaging** when the hero is a retail container with label (bottle, tube, jar, labeled box, wrapped bar with sleeve) — common in beauty/supplement top bands
- role **product** when the hero is loose units/items without retail packaging visible

If it shows loose units/items AND separate retail packaging, return TWO elements: role "product" for the units/stack, role "packaging" for the user's packaging zone.
Describe each element's **layout zone only** (e.g. "lower right hero zone", "beside main stack") — do NOT name the reference competitor's container type (avoid "supplement bottle" — say "packaging in lower right").
If packaging is visible, you MUST include role "packaging" — never merge packaging into "product" only.
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
  return { elements: elements.slice(0, 8), usage };
}
