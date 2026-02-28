import { NextRequest, NextResponse } from 'next/server';

const KIE_BASE = 'https://api.kie.ai/api/v1/jobs';
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 120000; // 2 min

function getKieApiKey(): string {
  const key = process.env.KIE_AI_API_KEY;
  if (!key) {
    throw new Error('KIE_AI_API_KEY is not set. Add it to .env.local');
  }
  return key;
}

/** Upload base64 image to ImgBB and return public URL */
async function uploadImageToImgBB(base64DataUrl: string): Promise<string> {
  const key = process.env.IMGBB_API_KEY;
  if (!key) {
    throw new Error('IMGBB_API_KEY is not set. Add it to .env.local to upload the product image.');
  }
  const base64Only = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
  const form = new FormData();
  form.set('key', key);
  form.set('image', base64Only);

  const res = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: form,
  });
  const json = await res.json();
  if (!json.success || !json.data?.url) {
    throw new Error(json?.error?.message || 'Failed to upload image to ImgBB');
  }
  return json.data.url as string;
}

/** Create Nano Banana task and return taskId */
async function createKieTask(
  apiKey: string,
  prompt: string,
  imageInputUrl: string,
  aspectRatio: string,
  callBackUrl: string | undefined
): Promise<string> {
  const body = {
    model: 'nano-banana-2',
    callBackUrl: callBackUrl || undefined,
    input: {
      prompt,
      image_input: [imageInputUrl],
      aspect_ratio: aspectRatio,
      google_search: false,
      resolution: '1K',
      output_format: 'jpg',
    },
  };

  const res = await fetch(`${KIE_BASE}/createTask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const result = await res.json();
  if (result.code !== 200 || !result.data?.taskId) {
    throw new Error(result.message || result.error || 'Kie createTask failed');
  }
  return result.data.taskId as string;
}

/** Poll recordInfo until state is success or failed */
async function pollRecordInfo(apiKey: string, taskId: string): Promise<{ resultUrls: string[]; state: string }> {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const res = await fetch(`${KIE_BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const result = await res.json();
    if (result.code !== 200 || !result.data) {
      throw new Error(result.message || 'Failed to get task status');
    }
    const { state, resultJson, failMsg } = result.data;
    if (state === 'failed') {
      throw new Error(failMsg || 'Task failed');
    }
    if (state === 'success' && resultJson) {
      try {
        const parsed = typeof resultJson === 'string' ? (JSON.parse(resultJson) as { resultUrls?: string[] }) : resultJson as { resultUrls?: string[] };
        const urls = parsed?.resultUrls;
        if (Array.isArray(urls) && urls.length > 0) {
          return { resultUrls: urls, state: 'success' };
        }
      } catch {
        // ignore parse error, keep polling or fail at timeout
      }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Task timed out');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, productImageBase64, aspectRatio: aspectRatioParam } = body as {
      prompt?: string;
      productImageBase64?: string;
      aspectRatio?: string;
    };
    if (!prompt || typeof prompt !== 'string' || !productImageBase64 || typeof productImageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid prompt and productImageBase64' },
        { status: 400 }
      );
    }

    const allowedRatios = ['9:16', '16:9', '1:1', 'auto'];
    const aspectRatio =
      typeof aspectRatioParam === 'string' && allowedRatios.includes(aspectRatioParam)
        ? aspectRatioParam
        : 'auto';

    const apiKey = getKieApiKey();
    const productImageUrl = await uploadImageToImgBB(productImageBase64);
    const callBackUrl = process.env.KIE_CALLBACK_URL || undefined;

    const taskId = await createKieTask(apiKey, prompt, productImageUrl, aspectRatio, callBackUrl);
    const { resultUrls } = await pollRecordInfo(apiKey, taskId);

    return NextResponse.json({
      imageUrl: resultUrls[0],
      resultUrls,
      taskId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
