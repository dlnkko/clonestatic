import type { GoogleGenAI } from '@google/genai';
import { extractUsage, parseJson } from '@/lib/adaptation/gemini';
import type { Step2Usage } from '@/lib/adaptation/types';
import { fetchImageWithRetry } from '@/lib/fetch-image';
import { GEMINI_MODEL } from '@/lib/gemini-model';
import type {
  MatchedProductImage,
  ProductImage,
  ReferenceProductElement,
  ReferenceProductUnitsProfile,
} from './types';
import { anchorMatchedDescriptions, catalogMatchDescription } from './product-fidelity';
import { ensureLogoCatalogMatches } from './ensure-logo-match';

export type MatchProductImagesResult = {
  matches: MatchedProductImage[];
  usage: Step2Usage | null;
};

const TRUST_HINT =
  /award|seal|badge|winner|certified|trust|medal|editor|beauty|authority|press|as-seen/i;

function pickFallbackIndex(
  productImages: ProductImage[],
  el: ReferenceProductElement,
  usedDistinct: Set<number>,
  preferUnused: boolean
): number {
  if (el.role === 'logo') {
    const logoIdx = productImages.findIndex((img) => img.kind === 'logo');
    if (logoIdx >= 0) return logoIdx;
  }
  if (el.role === 'lifestyle') {
    const lifeIdx = productImages.findIndex((img) => img.kind === 'lifestyle');
    if (lifeIdx >= 0) return lifeIdx;
  }
  if (el.role === 'trust_badge') {
    const trustIdx = productImages.findIndex((img) => img.kind === 'trust_badge');
    if (trustIdx >= 0) return trustIdx;
    const hintIdx = productImages.findIndex((img) =>
      TRUST_HINT.test(`${img.url} ${img.alt || ''}`)
    );
    if (hintIdx >= 0) return hintIdx;
  }
  if (el.role === 'product') {
    const desc = el.description.toLowerCase();
    if (/thought bubble|dream bubble|speech bubble|bubble only|symbolic|loose|gummy|unit/i.test(desc)) {
      const productIdx = productImages.findIndex(
        (img) => img.kind === 'product' || /gumm|unit|loose/i.test(`${img.url} ${img.alt || ''}`)
      );
      if (productIdx >= 0) return productIdx;
    }
  }
  const productLike = productImages.filter(
    (img) => img.kind === 'product' || img.kind === 'packaging' || img.kind === 'other'
  );
  const pool =
    el.role === 'packaging'
      ? productImages.filter((img) => img.kind === 'packaging' || img.kind === 'product')
      : productLike.length > 0
        ? productLike
        : productImages;

  for (let i = 0; i < productImages.length; i++) {
    const img = productImages[i];
    if (!pool.includes(img)) continue;
    if (preferUnused && usedDistinct.has(i)) continue;
    return i;
  }
  return productImages.length > 0 ? 0 : -1;
}

function finalizeMatches(
  matches: MatchedProductImage[],
  referenceElements: ReferenceProductElement[],
  productImages: ProductImage[]
): MatchedProductImage[] {
  for (const el of referenceElements) {
    if (el.role !== 'trust_badge') continue;
    if (matches.some((m) => m.role === 'trust_badge')) continue;
    const idx = productImages.findIndex((img) => img.kind === 'trust_badge');
    const pick =
      idx >= 0
        ? idx
        : productImages.findIndex((img) => TRUST_HINT.test(`${img.url} ${img.alt || ''}`));
    if (pick >= 0) {
      matches.push({
        role: 'trust_badge',
        url: productImages[pick].url,
        catalogImageIndex: pick,
        description: catalogMatchDescription('trust_badge', productImages[pick], el.description),
      });
    }
  }

  ensureLogoCatalogMatches(matches, referenceElements, productImages);

  for (let i = 0; i < referenceElements.length; i++) {
    const el = referenceElements[i];
    if (el.role !== 'packaging') continue;

    const existingIdx = matches.findIndex((m) => m.role === 'packaging');
    const packagingIdx = productImages.findIndex((img) => img.kind === 'packaging');
    const labelIdx =
      packagingIdx >= 0
        ? packagingIdx
        : productImages.findIndex((img) =>
            /label|wrap|sleeve|carton|packaging|pack-shot|bar-soap|soap-bar/i.test(
              `${img.url} ${img.alt || ''}`
            )
          );

    if (labelIdx >= 0) {
      const img = productImages[labelIdx];
      const entry = {
        role: 'packaging' as const,
        url: img.url,
        catalogImageIndex: labelIdx,
        description: catalogMatchDescription('packaging', img, el.description),
      };
      if (existingIdx >= 0) matches[existingIdx] = entry;
      else if (matches.length < referenceElements.length) matches.push(entry);
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const el = referenceElements[i];
    if (!el) continue;
    // Only upgrade to packaging when reference explicitly had a packaging element — not for loose units / bubble-only ads.
    if (el.role !== 'packaging') continue;
    const needsPackaging = el.role === 'packaging';
    if (!needsPackaging) continue;
    const packagingIdx = productImages.findIndex(
      (img) =>
        img.kind === 'packaging' ||
        /label|wrap|sleeve|carton|packaging|pack-shot/i.test(`${img.url} ${img.alt || ''}`)
    );
    if (packagingIdx >= 0 && matches[i].role !== 'packaging') {
      matches[i] = {
        role: 'packaging',
        url: productImages[packagingIdx].url,
        catalogImageIndex: packagingIdx,
        description: catalogMatchDescription(
          'packaging',
          productImages[packagingIdx],
          el.description
        ),
      };
    }
  }

  return anchorMatchedDescriptions(
    matches.length > 0
      ? matches
      : [
          {
            role: 'product',
            url: productImages[0].url,
            catalogImageIndex: 0,
            description: catalogMatchDescription('product', productImages[0]),
          },
        ],
    productImages,
    referenceElements
  );
}

/** Heuristic catalog matching — no Gemini call (Step 1 already lists reference elements). */
export function matchProductImagesHeuristic(
  referenceElements: ReferenceProductElement[],
  productImages: ProductImage[],
  unitsProfile?: ReferenceProductUnitsProfile | null
): MatchedProductImage[] {
  if (productImages.length === 0) return [];
  if (referenceElements.length === 0) {
    return [
      {
        role: 'product',
        url: productImages[0].url,
        description: catalogMatchDescription('product', productImages[0]),
      },
    ];
  }

  if (productImages.length === 1 && referenceElements.length === 1) {
    return finalizeMatches(
      [
        {
          role: referenceElements[0].role,
          url: productImages[0].url,
          catalogImageIndex: 0,
          description: catalogMatchDescription(
            referenceElements[0].role,
            productImages[0],
            referenceElements[0].description
          ),
        },
      ],
      referenceElements,
      productImages
    );
  }

  const distinctVariants = unitsProfile?.distinctVariants === true;
  const matches: MatchedProductImage[] = [];
  const usedDistinct = new Set<number>();

  for (let i = 0; i < referenceElements.length; i++) {
    const el = referenceElements[i];
    let idx = pickFallbackIndex(productImages, el, usedDistinct, distinctVariants);
    if (idx == null || idx < 0) continue;

    if (distinctVariants && usedDistinct.has(idx)) {
      const alt = pickFallbackIndex(productImages, el, usedDistinct, true);
      if (alt != null && alt >= 0) idx = alt;
    }
    if (distinctVariants) usedDistinct.add(idx);

    matches.push({
      role: el.role as MatchedProductImage['role'],
      url: productImages[idx].url,
      slotIndex: el.slotIndex,
      catalogImageIndex: idx,
      description: catalogMatchDescription(el.role, productImages[idx], el.description),
    });
  }

  return finalizeMatches(matches, referenceElements, productImages);
}

/** Legacy Gemini matcher — prefer matchProductImagesHeuristic in the 3-call pipeline. */
export async function matchProductImagesToReference(
  ai: GoogleGenAI,
  referenceElements: ReferenceProductElement[],
  productImages: ProductImage[],
  productName: string,
  unitsProfile?: ReferenceProductUnitsProfile | null
): Promise<MatchProductImagesResult> {
  if (productImages.length === 0) return { matches: [], usage: null };

  const heuristic = matchProductImagesHeuristic(referenceElements, productImages, unitsProfile);
  if (productImages.length <= 4 && referenceElements.length <= 3) {
    return { matches: heuristic, usage: null };
  }

  const catalog = productImages.map((img, i) => ({
    index: i,
    kind: img.kind || 'other',
    alt: img.alt || '',
  }));

  const distinctVariants = unitsProfile?.distinctVariants === true;
  const variantRule = distinctVariants
    ? `- Reference shows ${unitsProfile?.unitCount ?? referenceElements.length} DISTINCT variants — pick a DIFFERENT catalog index per slot when possible.`
    : `- Repeated identical units — MAY reuse same catalog index.`;

  const prompt = `Match catalog photos to reference layout roles. Minimum set only.

Product: "${productName}"
Reference rows:
${referenceElements.map((e, i) => `${i + 1}. role=${e.role}: ${e.description}`).join('\n')}

Catalog:
${catalog.map((c) => `[${c.index}] kind=${c.kind}${c.alt ? ` alt=${c.alt}` : ''}`).join('\n')}

Rules: ${variantRule}
- packaging → kind=packaging; lifestyle → kind=lifestyle; logo → kind=logo; trust_badge → seal image only.

Output JSON: { "matches": [{ "role": string, "imageIndex": number, "description": string }] }`;

  try {
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' },
    });
    const raw =
      result.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim() || '';
    const parsed = parseJson<{
      matches: { role: string; imageIndex: number; description: string }[];
    }>(raw);

    const matches: MatchedProductImage[] = [];
    const usedDistinct = new Set<number>();
    const parsedMatches = parsed.matches || [];

    for (let i = 0; i < referenceElements.length; i++) {
      const el = referenceElements[i];
      const m = parsedMatches[i];
      let idx = m?.imageIndex;
      if (idx == null || idx < 0 || idx >= productImages.length) {
        idx = pickFallbackIndex(productImages, el, usedDistinct, distinctVariants);
      }
      if (idx == null || idx < 0) continue;
      if (distinctVariants) usedDistinct.add(idx);

      matches.push({
        role: (m?.role ?? el.role) as MatchedProductImage['role'],
        url: productImages[idx].url,
        slotIndex: el.slotIndex,
        catalogImageIndex: idx,
        description: catalogMatchDescription(
          (m?.role ?? el.role) as MatchedProductImage['role'],
          productImages[idx],
          el.description
        ),
      });
    }

    return {
      matches: finalizeMatches(matches, referenceElements, productImages),
      usage: extractUsage(result),
    };
  } catch {
    return { matches: heuristic, usage: null };
  }
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
