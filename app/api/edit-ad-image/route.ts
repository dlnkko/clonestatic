import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getClientIpHash, tryClaimFreeTrial } from '@/lib/free-trial';
import { editImageWithKie } from '@/lib/kie';

async function uploadImageToImgBB(base64DataUrl: string): Promise<string> {
  const key = process.env.IMGBB_API_KEY;
  if (!key) throw new Error('IMGBB_API_KEY is not set');
  const base64Only = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
  const form = new FormData();
  form.set('key', key);
  form.set('image', base64Only);
  const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
  const json = await res.json();
  if (!json.success || !json.data?.url) throw new Error(json?.error?.message || 'Failed to upload to ImgBB');
  return json.data.url as string;
}

function appendAspectRatioHint(prompt: string, aspectRatio: string): string {
  if (aspectRatio === 'auto') return prompt;
  return `${prompt}\n\nTarget aspect ratio for the final image: ${aspectRatio}.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, imageBase64, aspectRatio: aspectRatioParam } = body as {
      prompt?: string;
      imageBase64?: string;
      aspectRatio?: string;
    };
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid prompt' }, { status: 400 });
    }
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid imageBase64' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    const email = user.email.trim().toLowerCase();
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const ownerEmailFromEnv = process.env.OWNER_EMAIL?.trim()?.toLowerCase();
    const ownerEmail =
      ownerEmailFromEnv && ownerEmailFromEnv.length > 0 ? ownerEmailFromEnv : 'diegolinaresd10@gmail.com';
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
          .update({ credits_remaining: current - 1, updated_at: new Date().toISOString() })
          .eq('email', email);
        if (updateError) {
          console.error('edit-ad-image use-credit:', updateError);
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

    const allowedRatios = [
      '9:16',
      '16:9',
      '1:1',
      '2:3',
      '3:2',
      '3:4',
      '4:3',
      '4:5',
      '5:4',
      '1:4',
      '1:8',
      '4:1',
      '8:1',
      '21:9',
      'auto',
    ];
    const aspectRatio =
      typeof aspectRatioParam === 'string' && allowedRatios.includes(aspectRatioParam)
        ? aspectRatioParam
        : 'auto';

    const imageUrl = await uploadImageToImgBB(imageBase64);
    const fullPrompt = appendAspectRatioHint(prompt, aspectRatio);
    const { imageUrl: outUrl, taskId } = await editImageWithKie({
      prompt: fullPrompt,
      imageUrl,
      aspectRatio,
    });

    return NextResponse.json({
      imageUrl: outUrl,
      resultUrls: [outUrl],
      taskId,
      model: 'gpt-image-2-image-to-image',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to edit image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
