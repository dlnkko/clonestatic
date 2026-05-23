import type { GoogleGenAI } from '@google/genai';
import { parseJson } from '@/lib/adaptation/gemini';
import { GEMINI_MODEL } from '@/lib/gemini-model';
import type {
  MatchedProductImage,
  ProductImage,
  ReferenceProductElement,
} from './types';

export async function matchProductImagesToReference(
  ai: GoogleGenAI,
  referenceElements: ReferenceProductElement[],
  productImages: ProductImage[],
  productName: string
): Promise<MatchedProductImage[]> {
  if (productImages.length === 0) return [];
  if (referenceElements.length === 0) {
    return [
      {
        role: 'product',
        url: productImages[0].url,
        description: 'Primary product image',
      },
    ];
  }

  if (productImages.length === 1 && referenceElements.length === 1) {
    return [
      {
        role: referenceElements[0].role,
        url: productImages[0].url,
        description: referenceElements[0].description,
      },
    ];
  }

  const catalog = productImages.map((img, i) => ({
    index: i,
    url: img.url,
    kind: img.kind || 'other',
    alt: img.alt || '',
  }));

  const prompt = `You match product page photos to roles needed in a cloned static ad.

Product brand: "${productName}"

Reference ad needs these visual elements:
${referenceElements.map((e, i) => `${i + 1}. role=${e.role}: ${e.description}`).join('\n')}

Available product images (by index):
${catalog.map((c) => `[${c.index}] kind=${c.kind} url=${c.url.slice(0, 120)}${c.alt ? ` alt=${c.alt}` : ''}`).join('\n')}

For EACH reference element, pick the best matching image index. Rules:
- packaging → image showing box/pouch/tub/bottle packaging
- product → loose item, gummies, powder, device without outer box hero
- logo → brand logo image if available
- Same image index may be reused only if one photo clearly shows both
- Prefer distinct images when reference has multiple elements

Output JSON only:
{
  "matches": [
    { "role": string, "imageIndex": number, "description": string }
  ]
}`;

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json' },
  });

  const parts = result.candidates?.[0]?.content?.parts;
  const raw = parts?.map((p) => p.text || '').join('').trim() || '';
  const parsed = parseJson<{
    matches: { role: string; imageIndex: number; description: string }[];
  }>(raw);

  const matches: MatchedProductImage[] = [];
  const used = new Set<number>();
  for (const m of parsed.matches || []) {
    const idx = m.imageIndex;
    if (idx < 0 || idx >= productImages.length || used.has(idx)) continue;
    used.add(idx);
    matches.push({
      role: m.role as MatchedProductImage['role'],
      url: productImages[idx].url,
      description: m.description || referenceElements[matches.length]?.description || '',
    });
    if (matches.length >= referenceElements.length) break;
  }

  if (matches.length < referenceElements.length) {
    for (let i = 0; i < productImages.length && matches.length < referenceElements.length; i++) {
      if (used.has(i)) continue;
      const el = referenceElements[matches.length];
      matches.push({
        role: el.role,
        url: productImages[i].url,
        description: el.description,
      });
      used.add(i);
    }
  }

  return matches.length > 0
    ? matches
    : [{ role: 'product', url: productImages[0].url, description: 'Primary product' }];
}

/** Download image URL and upload to Gemini Files API */
export async function uploadProductImageUrlsToGemini(
  ai: GoogleGenAI,
  urls: string[]
): Promise<{ uri: string; mimeType?: string }[]> {
  const files: { uri: string; mimeType?: string }[] = [];
  for (const url of urls) {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) continue;
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const mimeType = contentType.split(';')[0].trim();
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type: mimeType });
    const uploaded = await ai.files.upload({ file: blob, config: { mimeType } });
    let file = uploaded;
    const fileName = file.name || file.uri?.split('/').pop() || '';
    const start = Date.now();
    while (file.state !== 'ACTIVE' && Date.now() - start < 60000) {
      await new Promise((r) => setTimeout(r, 2000));
      if (fileName) {
        try {
          file = await ai.files.get({ name: fileName });
        } catch {
          break;
        }
      } else break;
    }
    if (file.uri) files.push({ uri: file.uri, mimeType: file.mimeType || mimeType });
  }
  return files;
}
