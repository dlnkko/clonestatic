import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getClientIpHash, tryClaimFreeTrial } from '@/lib/free-trial';

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
      resolution: '2K',
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
    const { prompt, productImageBase64, productImageUrl: productImageUrlParam, aspectRatio: aspectRatioParam } = body as {
      prompt?: string;
      productImageBase64?: string;
      productImageUrl?: string;
      aspectRatio?: string;
    };
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid prompt' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    const email = user.email.trim().toLowerCase();
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const ownerEmailFromEnv = process.env.OWNER_EMAIL?.trim()?.toLowerCase();
    const ownerEmail =
      ownerEmailFromEnv && ownerEmailFromEnv.length > 0
        ? ownerEmailFromEnv
        : 'diegolinaresd10@gmail.com';
    const isOwner = email === ownerEmail;

    if (!isOwner) {
      const admin = createAdminClient();
      const { data: row, error: fetchError } = await admin
        .from('subscriptions')
        .select('credits_remaining')
        .eq('email', email)
        .single();
      const hasSubscription = !fetchError && row;
      const current = hasSubscription ? Math.max(0, row.credits_remaining ?? 0) : 0;

      if (hasSubscription && current >= 1) {
        const { error: updateError } = await admin
          .from('subscriptions')
          .update({
            credits_remaining: current - 1,
            updated_at: new Date().toISOString(),
          })
          .eq('email', email);
        if (updateError) {
          console.error('use-credit in generate-ad-image:', updateError);
          return NextResponse.json({ error: 'Failed to use credit' }, { status: 500 });
        }
      } else {
        const ipHash = getClientIpHash(request);
        const claimed = await tryClaimFreeTrial(admin, ipHash);
        if (!claimed) {
          return NextResponse.json({ error: 'No credits remaining', credits_remaining: 0 }, { status: 402 });
        }
      }
    }

    const allowedRatios = ['9:16', '16:9', '1:1', 'auto'];
    const aspectRatio =
      typeof aspectRatioParam === 'string' && allowedRatios.includes(aspectRatioParam)
        ? aspectRatioParam
        : 'auto';

    let productImageUrl: string;
    if (productImageUrlParam && typeof productImageUrlParam === 'string' && productImageUrlParam.startsWith('http')) {
      productImageUrl = productImageUrlParam;
    } else if (productImageBase64 && typeof productImageBase64 === 'string') {
      productImageUrl = await uploadImageToImgBB(productImageBase64);
    } else {
      return NextResponse.json(
        { error: 'Missing productImageUrl or productImageBase64' },
        { status: 400 }
      );
    }

    const apiKey = getKieApiKey();
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
