import type { AdVisualMode } from '@/lib/ad-visual-mode';
import { ensureKieCompatibleUrls } from '@/lib/images/normalize-image';
import { appendKieProductFidelityPrompt } from '@/lib/products/product-fidelity';
import {
  GENERATION_SERVER_ERROR,
  toUserFacingGenerationError,
} from '@/lib/user-facing-errors';

export { GENERATION_SERVER_ERROR, toUserFacingGenerationError };

const KIE_API_BASE = 'https://api.kie.ai';

/** Hard model/API failure — safe to try the other image model. */
export class KieTaskFailedError extends Error {
  readonly isKieTaskFailed = true as const;
  constructor(message = GENERATION_SERVER_ERROR) {
    super(message);
    this.name = 'KieTaskFailedError';
  }
}

/** Transient API/network error while polling — keep waiting, do not switch models. */
class KieApiError extends Error {
  constructor(message = GENERATION_SERVER_ERROR) {
    super(message);
    this.name = 'KieApiError';
  }
}

/** Poll ran out of time while the job was still running — do NOT switch models. */
export class KiePollTimeoutError extends Error {
  readonly isKiePollTimeout = true as const;
  constructor(message = GENERATION_SERVER_ERROR) {
    super(message);
    this.name = 'KiePollTimeoutError';
  }
}

function isKieTaskFailedError(err: unknown): boolean {
  return (
    err instanceof KieTaskFailedError ||
    (typeof err === 'object' &&
      err !== null &&
      'isKieTaskFailed' in err &&
      (err as { isKieTaskFailed?: boolean }).isKieTaskFailed === true)
  );
}

export function isKiePollTimeoutError(err: unknown): boolean {
  return (
    err instanceof KiePollTimeoutError ||
    (typeof err === 'object' &&
      err !== null &&
      'isKiePollTimeout' in err &&
      (err as { isKiePollTimeout?: boolean }).isKiePollTimeout === true)
  );
}

/** One-shot status check — used to recover results after serverless cutoff. */
export async function getKieTaskResultOnce(
  taskId: string
): Promise<
  | { state: 'success'; urls: string[] }
  | { state: 'fail' }
  | { state: 'pending' }
> {
  try {
    const json = await kieFetch<KieRecordResponse>(
      `/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`
    );
    const state = (json.data?.state ?? '').toLowerCase();
    if (state === 'success') {
      const urls = parseResultUrls(json.data?.resultJson);
      return urls.length > 0 ? { state: 'success', urls } : { state: 'fail' };
    }
    if (state === 'fail' || state === 'failed' || state === 'error') {
      return { state: 'fail' };
    }
    return { state: 'pending' };
  } catch {
    return { state: 'pending' };
  }
}

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
    throw new KieTaskFailedError(GENERATION_SERVER_ERROR);
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
    throw new KieApiError(GENERATION_SERVER_ERROR);
  }
  return json;
}

export async function createKieTask(body: Record<string, unknown>): Promise<string> {
  try {
    const json = await kieFetch<KieCreateResponse>('/api/v1/jobs/createTask', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const taskId = json.data?.taskId;
    if (!taskId) throw new KieTaskFailedError(GENERATION_SERVER_ERROR);
    return taskId;
  } catch (err) {
    if (isKieTaskFailedError(err)) throw err;
    throw new KieTaskFailedError(GENERATION_SERVER_ERROR);
  }
}

export async function pollKieTask(
  taskId: string,
  options: { pollIntervalMs?: number; timeoutMs?: number } = {}
): Promise<string[]> {
  const pollIntervalMs = options.pollIntervalMs ?? 3000;
  /** Single-model wait under serverless maxDuration (300s) with headroom. */
  const timeoutMs = options.timeoutMs ?? 270_000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const json = await kieFetch<KieRecordResponse>(
        `/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`
      );
      const state = (json.data?.state ?? '').toLowerCase();

      if (state === 'success') {
        const urls = parseResultUrls(json.data?.resultJson);
        if (urls.length === 0) throw new KieTaskFailedError(GENERATION_SERVER_ERROR);
        return urls;
      }

      if (state === 'fail' || state === 'failed' || state === 'error') {
        throw new KieTaskFailedError(GENERATION_SERVER_ERROR);
      }
    } catch (err) {
      // Explicit job failure → stop. Transient poll/API blips → keep waiting.
      if (isKieTaskFailedError(err)) throw err;
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new KiePollTimeoutError(GENERATION_SERVER_ERROR);
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
  pollTimeoutMs?: number;
  onTaskCreated?: (taskId: string, model: string) => void | Promise<void>;
};

async function generateOnceWithMode(
  params: GenerateOnceParams
): Promise<{ imageUrl: string; taskId: string; model: string; adVisualMode: AdVisualMode }> {
  const {
    fidelityPrompt,
    catalogUrls,
    aspectRatio,
    mode,
    referenceProductVisibility,
    pollTimeoutMs = 270_000,
    onTaskCreated,
  } = params;
  const ratio = mapAspectRatio(aspectRatio, mode);

  let taskId: string;
  let model: string;

  if (mode === 'design') {
    model = 'nano-banana-pro';
    const urls = catalogUrls.slice(0, 8);

    if (urls.length === 0 && referenceProductVisibility !== 'none') {
      throw new KieTaskFailedError('No valid product image URLs for design generation');
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
      throw new KieTaskFailedError('No valid product image URLs for realistic generation');
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

  // Persist ASAP so UI can recover if this serverless invocation dies mid-poll.
  if (onTaskCreated) {
    try {
      await onTaskCreated(taskId, model);
    } catch (err) {
      console.warn('[image-gen] onTaskCreated failed:', err);
    }
  }

  const resultUrls = await pollKieTask(taskId, { timeoutMs: pollTimeoutMs });
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
  /** Called as soon as a Kie task id exists (primary or fallback). */
  onTaskCreated?: (taskId: string, model: string) => void | Promise<void>;
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
    onTaskCreated,
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
      onTaskCreated,
    });
  } catch (primaryErr) {
    // Only switch models on an explicit Kie failure — never on slow poll / timeout.
    if (!isKieTaskFailedError(primaryErr)) {
      console.warn(
        `[image-gen] primary model (${primary}) timed out or aborted — not falling back:`,
        primaryErr instanceof Error ? primaryErr.message : primaryErr
      );
      // Preserve timeout type so callers can leave the creation as "generating".
      if (isKiePollTimeoutError(primaryErr)) throw primaryErr;
      throw new Error(toUserFacingGenerationError(primaryErr));
    }

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
        onTaskCreated,
      });
    } catch (secondaryErr) {
      console.error(
        `[image-gen] fallback model (${secondary}) also failed:`,
        secondaryErr instanceof Error ? secondaryErr.message : secondaryErr
      );
      if (isKiePollTimeoutError(secondaryErr)) throw secondaryErr;
      throw new Error(toUserFacingGenerationError(secondaryErr));
    }
  }
}

/** Edits prefer GPT Image 2; fall back to nano-banana-pro only if GPT returns a hard failure. */
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
    if (!isKieTaskFailedError(primaryErr)) {
      console.warn(
        '[image-gen] edit primary (gpt-image-2) timed out — not falling back:',
        primaryErr instanceof Error ? primaryErr.message : primaryErr
      );
      throw new Error(toUserFacingGenerationError(primaryErr));
    }

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
