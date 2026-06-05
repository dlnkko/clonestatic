import type { AdVisualMode } from '@/lib/ad-visual-mode';
import { ensureKieCompatibleUrls } from '@/lib/images/normalize-image';
import { appendKieProductFidelityPrompt } from '@/lib/products/product-fidelity';

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
    throw new Error(
      'KIE_API_KEY is not set. Add it to .env.local (get one at https://kie.ai/api-key)'
    );
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
    const msg =
      (json as { msg?: string }).msg ||
      `Kie API error (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

export async function createKieTask(body: Record<string, unknown>): Promise<string> {
  const json = await kieFetch<KieCreateResponse>('/api/v1/jobs/createTask', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const taskId = json.data?.taskId;
  if (!taskId) throw new Error('Kie API did not return taskId');
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
      if (urls.length === 0) throw new Error('Kie task succeeded but returned no image URLs');
      return urls;
    }

    if (state === 'fail') {
      const detail = json.data?.failMsg || json.data?.failCode || 'Generation failed';
      throw new Error(`Kie task failed: ${detail}`);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error('Kie task timed out');
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

export async function generateAdImageWithKie(params: {
  prompt: string;
  productImageUrls: string[];
  referenceImageUrl?: string | null;
  aspectRatio: string;
  adVisualMode: AdVisualMode;
}): Promise<{ imageUrl: string; taskId: string; model: string; adVisualMode: AdVisualMode }> {
  const { prompt, productImageUrls, referenceImageUrl, aspectRatio, adVisualMode } = params;
  const ratio = mapAspectRatio(aspectRatio, adVisualMode);
  const rawCatalogUrls = productImageUrls.filter((u) => u.startsWith('http')).slice(0, 8);
  const catalogUrls = await ensureKieCompatibleUrls(rawCatalogUrls);
  const fidelityPrompt = appendKieProductFidelityPrompt(prompt, catalogUrls.length > 0);

  let taskId: string;
  let model: string;

  if (adVisualMode === 'design') {
    model = 'nano-banana-pro';
    const rawReference = referenceImageUrl?.startsWith('http') ? referenceImageUrl : null;
    const [referenceConverted] = rawReference
      ? await ensureKieCompatibleUrls([rawReference])
      : [null];
    // Product catalog first so the model anchors on user's real product; reference last for layout only.
    const imageInput = [
      ...catalogUrls,
      ...(referenceConverted ? [referenceConverted] : []),
    ].slice(0, 8);

    taskId = await createKieTask({
      model,
      input: {
        prompt: fidelityPrompt,
        image_input: imageInput,
        aspect_ratio: ratio,
        resolution: '2K',
        output_format: 'png',
      },
    });
  } else {
    model = 'gpt-image-2-image-to-image';
    const inputUrls = catalogUrls.slice(0, 16);

    if (inputUrls.length === 0) {
      throw new Error('No valid product image URLs for realistic generation');
    }

    const input: Record<string, unknown> = {
      prompt: fidelityPrompt,
      input_urls: inputUrls,
      aspect_ratio: ratio,
      // Always force 2K for GPT Image 2 requests.
      resolution: '2K',
    };

    taskId = await createKieTask({ model, input });
  }

  const resultUrls = await pollKieTask(taskId);
  return {
    imageUrl: resultUrls[0],
    taskId,
    model,
    adVisualMode,
  };
}

/** Edits always use GPT Image 2 (photo / realistic adjustments). */
export async function editImageWithKie(params: {
  prompt: string;
  imageUrl: string;
  aspectRatio?: string;
}): Promise<{ imageUrl: string; taskId: string }> {
  const ratio = mapAspectRatio(params.aspectRatio ?? 'auto', 'realistic');
  const [compatibleUrl] = await ensureKieCompatibleUrls([params.imageUrl]);
  const taskId = await createKieTask({
    model: 'gpt-image-2-image-to-image',
    input: {
      prompt: params.prompt,
      input_urls: [compatibleUrl],
      aspect_ratio: ratio,
      // Always force 2K for GPT Image 2 requests.
      resolution: '2K',
    },
  });
  const resultUrls = await pollKieTask(taskId);
  return { imageUrl: resultUrls[0], taskId };
}
