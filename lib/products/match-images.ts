import type { GoogleGenAI } from '@google/genai';
import { extractUsage, parseJson } from '@/lib/adaptation/gemini';
import type { Step2Usage } from '@/lib/adaptation/types';
import { fetchImageWithRetry } from '@/lib/fetch-image';
import { GEMINI_MODEL } from '@/lib/gemini-model';
import type {
  MatchedProductImage,
  ProductImage,
  ReferenceProductElement,
} from './types';

export type MatchProductImagesResult = {
  matches: MatchedProductImage[];
  usage: Step2Usage | null;
};

const TRUST_HINT =
  /award|seal|badge|winner|certified|trust|medal|editor|beauty|authority|press|as-seen/i;

export async function matchProductImagesToReference(
  ai: GoogleGenAI,
  referenceElements: ReferenceProductElement[],
  productImages: ProductImage[],
  productName: string
): Promise<MatchProductImagesResult> {
  if (productImages.length === 0) return { matches: [], usage: null };
  if (referenceElements.length === 0) {
    return {
      matches: [
        {
          role: 'product',
          url: productImages[0].url,
          description: 'Primary product image',
        },
      ],
      usage: null,
    };
  }

  if (productImages.length === 1 && referenceElements.length === 1) {
    return {
      matches: [
        {
          role: referenceElements[0].role,
          url: productImages[0].url,
          description: referenceElements[0].description,
        },
      ],
      usage: null,
    };
  }

  const catalog = productImages.map((img, i) => ({
    index: i,
    url: img.url,
    kind: img.kind || 'other',
    alt: img.alt || '',
  }));

  const prompt = `You match product page photos to roles needed in a cloned static ad.
Only the images you select (by index) will be downloaded and sent to the image model — pick the minimum set that covers each reference element. Do not select extra catalog images.

Product brand: "${productName}"

Reference ad needs these visual elements:
${referenceElements.map((e, i) => `${i + 1}. role=${e.role}: ${e.description}`).join('\n')}

Available product images (by index):
${catalog.map((c) => `[${c.index}] kind=${c.kind} url=${c.url.slice(0, 120)}${c.alt ? ` alt=${c.alt}` : ''}`).join('\n')}

For EACH reference element, pick the best matching image index. Rules:
- packaging → MUST be box/pouch/tub/bottle/jar/carton with visible packaging graphics (prefer kind=packaging). NEVER assign a loose product flat lay, folded item, or duplicate hero stack to packaging.
- product → loose item, units, gummies, capsules, powder, device, pillowcase stack (NOT the retail bottle/box unless reference has no separate packaging)
- lifestyle → prefer kind=lifestyle (model, in-use, on bed, worn correctly) over flat packshots when reference shows a person using the product
- logo → brand logo image if available
- trust_badge → MUST pick an image with kind=trust_badge (award seal, press badge, certification). If several trust_badge images exist, pick the clearest award/press seal. NEVER skip trust_badge when reference needs it.
- trust_badge images are separate assets — do not use a product photo as the seal
- Same image index may be reused only if one photo clearly shows both
- Prefer distinct images when reference has multiple elements
- When reference has trust_badge, include it in matches even if product images are also needed

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

  for (const el of referenceElements) {
    if (el.role !== 'trust_badge') continue;
    if (matches.some((m) => m.role === 'trust_badge')) continue;
    const idx = productImages.findIndex(
      (img, i) => !used.has(i) && img.kind === 'trust_badge'
    );
    const pick = idx >= 0 ? idx : productImages.findIndex((img) => TRUST_HINT.test(`${img.url} ${img.alt || ''}`));
    if (pick >= 0) {
      matches.push({
        role: 'trust_badge',
        url: productImages[pick].url,
        description: el.description,
      });
      used.add(pick);
    }
  }

  // Ensure packaging slots use packaging photos, not loose product shots
  for (let i = 0; i < referenceElements.length; i++) {
    const el = referenceElements[i];
    if (el.role !== 'packaging') continue;

    const existingIdx = matches.findIndex((m) => m.role === 'packaging');
    const packagingIdx = productImages.findIndex((img) => img.kind === 'packaging');

    if (packagingIdx >= 0) {
      const packagingUrl = productImages[packagingIdx].url;
      if (existingIdx >= 0) {
        matches[existingIdx] = {
          role: 'packaging',
          url: packagingUrl,
          description: el.description,
        };
      } else if (matches.length < referenceElements.length) {
        matches.push({
          role: 'packaging',
          url: packagingUrl,
          description: el.description,
        });
      }
    }
  }

  const usage = extractUsage(result);
  return {
    matches:
      matches.length > 0
        ? matches
        : [{ role: 'product', url: productImages[0].url, description: 'Primary product' }],
    usage,
  };
}

async function waitForGeminiFileActive(
  ai: GoogleGenAI,
  uploaded: { name?: string; uri?: string; state?: string; mimeType?: string },
  mimeType: string
): Promise<{ uri: string; mimeType?: string } | null> {
  let file = uploaded;
  const fileName = file.name || file.uri?.split('/').pop() || '';
  const start = Date.now();
  while (file.state !== 'ACTIVE' && Date.now() - start < 60_000) {
    await new Promise((r) => setTimeout(r, 2000));
    if (!fileName) break;
    try {
      file = await ai.files.get({ name: fileName });
    } catch {
      break;
    }
  }
  if (!file.uri) return null;
  return { uri: file.uri, mimeType: file.mimeType || mimeType };
}

async function uploadOneUrlToGemini(
  ai: GoogleGenAI,
  url: string
): Promise<{ uri: string; mimeType?: string } | null> {
  const fetched = await fetchImageWithRetry(url);
  if (!fetched) return null;

  try {
    const blob = new Blob([fetched.buffer], { type: fetched.mimeType });
    const uploaded = await ai.files.upload({
      file: blob,
      config: { mimeType: fetched.mimeType },
    });
    return await waitForGeminiFileActive(ai, uploaded, fetched.mimeType);
  } catch (err) {
    console.warn('[uploadProductImage] Gemini upload failed:', url.slice(0, 100), err);
    return null;
  }
}

/**
 * Download image URLs (with retries) and upload to Gemini Files API.
 * Never throws on a single bad URL; returns whatever succeeded.
 */
export async function uploadProductImageUrlsToGemini(
  ai: GoogleGenAI,
  urls: string[]
): Promise<{ uri: string; mimeType?: string }[]> {
  const unique = [...new Set(urls.filter((u) => typeof u === 'string' && u.startsWith('http')))];
  if (unique.length === 0) return [];

  const files: { uri: string; mimeType?: string }[] = [];
  const batchSize = 2;

  for (let i = 0; i < unique.length; i += batchSize) {
    const chunk = unique.slice(i, i + batchSize);
    const results = await Promise.all(chunk.map((url) => uploadOneUrlToGemini(ai, url)));
    for (const r of results) {
      if (r) files.push(r);
    }
  }

  if (files.length < unique.length) {
    console.warn(
      `[uploadProductImage] ${files.length}/${unique.length} URLs uploaded to Gemini`
    );
  }

  return files;
}
