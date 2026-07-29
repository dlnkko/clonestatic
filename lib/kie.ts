import type { AdVisualMode } from '@/lib/ad-visual-mode';
import { ensureKieCompatibleUrls } from '@/lib/images/normalize-image';
import { appendKieProductFidelityPrompt } from '@/lib/products/product-fidelity';
import {
  GENERATION_SERVER_ERROR,
  toUserFacingGenerationError,
} from '@/lib/user-facing-errors';

export { GENERATION_SERVER_ERROR, toUserFacingGenerationError };

const KIE_API_BASE = 'https://api.kie.ai';

type KieCreateResponse = {
  code?: number;
  msg?: string;
  data?: { taskId?: string };
};

type KieRecordResponse = {
  code?: number;
  msg?: string;
  data?: {
    taskId?: string;
    state?: string;
    resultJson?: string;
    failMsg?: string;
    failCode?: string;
  };
};

function getKieApiKey(): string {
  const key =
    process.env.KIE_API_KEY?.trim() || process.env.KIE_AI_API_KEY?.trim();
  if (!key) {
    throw new Error(GENERATION_SERVER_ERROR);
  }
  return key;
}

function mapAspectRatio(aspectRatio: string, mode: AdVisualMode): string {
  if (aspectRatio === 'auto') return 'auto';

  if (mode === 'design') {
    const allowed = new Set([
      '1:1',
      '2:3',
      '3:2',
      '3:4',
      '4:3',
      '4:5',
      '5:4',
      '9:16',
      '16:9',
      '21:9',
    ]);
    return allowed.has(aspectRatio) ? aspectRatio : 'auto';
  }

  const gptAllowed = new Set(['1:1', '9:16', '16:9', '4:3', '3:4']);
  if (gptAllowed.has(aspectRatio)) return aspectRatio;

  const fallback: Record<string, string> = {
    '2:3': '3:4',
    '3:2': '4:3',
    '4:5': '3:4',
    '5:4': '4:3',
    '21:9': '16:9',
    '1:4': '9:16',
    '1:8': '9:16',
    '4:1': '16:9',
    '8:1': '16:9',
  };
  return fallback[aspectRatio] ?? 'auto';
}

async function kieFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${KIE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getKieApiKey()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as T & { code?: number; msg?: string };
  if (!res.ok || (json.code !== undefined && json.code !== 200)) {
    throw new Error(GENERATION_SERVER_ERROR);
  }
  return json;
}

export async function createKieTask(body: Record<string, unknown>): Promise<string> {
  const json = await kieFetch<KieCreateResponse>('/api/v1/jobs/createTask', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const taskId = json.data?.taskId;
  if (!taskId) throw new Error(GENERATION_SERVER_ERROR);
  return taskId;
}

export async function pollKieTask(
  taskId: string,
  options: { pollIntervalMs?: number; timeoutMs?: number } = {}
): Promise<string[]> {
  const pollIntervalMs = options.pollIntervalMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 300000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const json = await kieFetch<KieRecordResponse>(
      `/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`
    );
    const state = (json.data?.state ?? '').toLowerCase();

    if (state === 'success') {
      const urls = parseResultUrls(json.data?.resultJson);
      if (urls.length === 0) throw new Error(GENERATION_SERVER_ERROR);
      return urls;
    }

    if (state === 'fail') {
      throw new Error(GENERATION_SERVER_ERROR);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(GENERATION_SERVER_ERROR);
}

function parseResultUrls(resultJson: string | undefined): string[] {
  if (!resultJson) return [];
  try {
    const parsed = JSON.parse(resultJson) as { resultUrls?: string[] };
    if (Array.isArray(parsed.resultUrls)) {
      return parsed.resultUrls.filter((u) => typeof u === 'string' && u.startsWith('http'));
    }
  } catch {
    // ignore
  }
  return [];
}

type GenerateOnceParams = {
  fidelityPrompt: string;
  catalogUrls: string[];
  aspectRatio: string;
  mode: AdVisualMode;
  referenceProductVisibility?: import('@/lib/adaptation/parse-reference-analysis').ReferenceProductVisibility;
};

async function generateOnceWithMode(
  params: GenerateOnceParams
): Promise<{ imageUrl: string; taskId: string; model: string; adVisualMode: AdVisualMode }> {
  const { fidelityPrompt, catalogUrls, aspectRatio, mode, referenceProductVisibility } = params;
  const ratio = mapAspectRatio(aspectRatio, mode);

  let taskId: string;
  let model: string;

  if (mode === 'design') {
    model = 'nano-banana-pro';
    const urls = catalogUrls.slice(0, 8);

    if (urls.length === 0 && referenceProductVisibility !== 'none') {
      throw new Error('No valid product image URLs for design generation');
    }

    taskId = await createKieTask({
      model,
      input: {
        prompt: fidelityPrompt,
        ...(urls.length > 0 ? { image_input: urls } : {}),
        aspect_ratio: ratio,
        resolution: '2K',
        output_format: 'png',
      },
    });
  } else {
    model = 'gpt-image-2-image-to-image';
    const urls = catalogUrls.slice(0, 16);

    if (urls.length === 0 && referenceProductVisibility !== 'none') {
      throw new Error('No valid product image URLs for realistic generation');
    }

    taskId = await createKieTask({
      model,
      input: {
        prompt: fidelityPrompt,
        ...(urls.length > 0 ? { input_urls: urls } : {}),
        aspect_ratio: ratio,
        resolution: '2K',
      },
    });
  }

  const resultUrls = await pollKieTask(taskId);
  return {
    imageUrl: resultUrls[0],
    taskId,
    model,
    adVisualMode: mode,
  };
}

export async function generateAdImageWithKie(params: {
  prompt: string;
  productImageUrls: string[];
  aspectRatio: string;
  adVisualMode: AdVisualMode;
  hasDedicatedLogo?: boolean;
  hasPersonInReference?: boolean;
  hasIllustrativeVisual?: boolean;
  visualMedium?: string;
  illustrationNotes?: string;
  productUseProfile?: import('@/lib/products/infer-product-use').ProductUseProfile | null;
  referenceHasPriceVisual?: boolean;
  allowedPrice?: string | null;
  productBrandColors?: string[];
  referenceProductVisibility?: import('@/lib/adaptation/parse-reference-analysis').ReferenceProductVisibility;
}): Promise<{ imageUrl: string; taskId: string; model: string; adVisualMode: AdVisualMode }> {
  const {
    prompt,
    productImageUrls,
    aspectRatio,
    adVisualMode,
    hasDedicatedLogo,
    hasPersonInReference,
    hasIllustrativeVisual,
    visualMedium,
    illustrationNotes,
    productUseProfile,
    referenceHasPriceVisual,
    allowedPrice,
    productBrandColors,
    referenceProductVisibility,
  } = params;

  const maxCatalog = 16;
  const rawCatalogUrls = productImageUrls.filter((u) => u.startsWith('http')).slice(0, maxCatalog);
  const catalogUrls = await ensureKieCompatibleUrls(rawCatalogUrls);
  const fidelityPrompt = appendKieProductFidelityPrompt(prompt, catalogUrls.length > 0, {
    hasDedicatedLogo,
    hasPersonInReference,
    hasIllustrativeVisual,
    visualMedium,
    illustrationNotes,
    productUseProfile,
    referenceHasPriceVisual,
    allowedPrice,
    productBrandColors,
    referenceProductVisibility,
  });

  const primary = adVisualMode;
  const secondary: AdVisualMode = adVisualMode === 'design' ? 'realistic' : 'design';

  try {
    return await generateOnceWithMode({
      fidelityPrompt,
      catalogUrls,
      aspectRatio,
      mode: primary,
      referenceProductVisibility,
    });
  } catch (primaryErr) {
    console.warn(
      `[image-gen] primary model (${primary}) failed, trying ${secondary}:`,
      primaryErr instanceof Error ? primaryErr.message : primaryErr
    );
    try {
      return await generateOnceWithMode({
        fidelityPrompt,
        catalogUrls,
        aspectRatio,
        mode: secondary,
        referenceProductVisibility,
      });
    } catch (secondaryErr) {
      console.error(
        `[image-gen] fallback model (${secondary}) also failed:`,
        secondaryErr instanceof Error ? secondaryErr.message : secondaryErr
      );
      throw new Error(toUserFacingGenerationError(secondaryErr));
    }
  }
}

/** Edits prefer GPT Image 2; fall back to nano-banana-pro if it fails. */
export async function editImageWithKie(params: {
  prompt: string;
  imageUrl: string;
  aspectRatio?: string;
}): Promise<{ imageUrl: string; taskId: string }> {
  const [compatibleUrl] = await ensureKieCompatibleUrls([params.imageUrl]);
  const aspectRatio = params.aspectRatio ?? 'auto';

  try {
    const ratio = mapAspectRatio(aspectRatio, 'realistic');
    const taskId = await createKieTask({
      model: 'gpt-image-2-image-to-image',
      input: {
        prompt: params.prompt,
        input_urls: [compatibleUrl],
        aspect_ratio: ratio,
        resolution: '2K',
      },
    });
    const resultUrls = await pollKieTask(taskId);
    return { imageUrl: resultUrls[0], taskId };
  } catch (primaryErr) {
    console.warn(
      '[image-gen] edit primary (gpt-image-2) failed, trying nano-banana-pro:',
      primaryErr instanceof Error ? primaryErr.message : primaryErr
    );
    try {
      const ratio = mapAspectRatio(aspectRatio, 'design');
      const taskId = await createKieTask({
        model: 'nano-banana-pro',
        input: {
          prompt: params.prompt,
          image_input: [compatibleUrl],
          aspect_ratio: ratio,
          resolution: '2K',
          output_format: 'png',
        },
      });
      const resultUrls = await pollKieTask(taskId);
      return { imageUrl: resultUrls[0], taskId };
    } catch (secondaryErr) {
      throw new Error(toUserFacingGenerationError(secondaryErr));
    }
  }
}
