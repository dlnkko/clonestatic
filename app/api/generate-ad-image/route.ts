import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getClientIpHash, tryClaimFreeTrial } from '@/lib/free-trial';
import { uploadBase64ToImgBB } from '@/lib/imgbb';
import type { AdVisualMode } from '@/lib/ad-visual-mode';
import { generateAdImageWithKie } from '@/lib/kie';

function appendAspectRatioHint(prompt: string, aspectRatio: string): string {
  if (aspectRatio === 'auto') return prompt;
  return `${prompt}\n\nTarget aspect ratio for the final image: ${aspectRatio}.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      productImageBase64,
      productImageUrl: productImageUrlParam,
      productImageUrls: productImageUrlsParam,
      referenceImageUrl: referenceImageUrlParam,
      referenceImageBase64,
      aspectRatio: aspectRatioParam,
      adVisualMode: adVisualModeParam,
      creationId: creationIdParam,
    } = body as {
      prompt?: string;
      productImageBase64?: string;
      productImageUrl?: string;
      productImageUrls?: string[];
      referenceImageUrl?: string;
      referenceImageBase64?: string;
      aspectRatio?: string;
      adVisualMode?: AdVisualMode;
      creationId?: string;
    };
    const creationId =
      typeof creationIdParam === 'string' && creationIdParam.trim()
        ? creationIdParam.trim()
        : null;
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid prompt' }, { status: 400 });
    }

    const adVisualMode: AdVisualMode =
      adVisualModeParam === 'realistic' ? 'realistic' : 'design';

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
          return NextResponse.json(
            { error: 'No credits remaining', credits_remaining: 0 },
            { status: 402 }
          );
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

    let productImageUrls: string[] = [];
    if (Array.isArray(productImageUrlsParam) && productImageUrlsParam.length > 0) {
      productImageUrls = productImageUrlsParam.filter(
        (u): u is string => typeof u === 'string' && u.startsWith('http')
      );
    }
    if (productImageUrls.length === 0) {
      if (
        productImageUrlParam &&
        typeof productImageUrlParam === 'string' &&
        productImageUrlParam.startsWith('http')
      ) {
        productImageUrls = [productImageUrlParam];
      } else if (productImageBase64 && typeof productImageBase64 === 'string') {
        productImageUrls = [await uploadBase64ToImgBB(productImageBase64)];
      }
    }
    if (productImageUrls.length === 0) {
      return NextResponse.json(
        { error: 'Missing productImageUrls, productImageUrl or productImageBase64' },
        { status: 400 }
      );
    }

    let referenceImageUrl: string | null = null;
    if (
      referenceImageUrlParam &&
      typeof referenceImageUrlParam === 'string' &&
      referenceImageUrlParam.startsWith('http')
    ) {
      referenceImageUrl = referenceImageUrlParam;
    } else if (referenceImageBase64 && typeof referenceImageBase64 === 'string') {
      referenceImageUrl = await uploadBase64ToImgBB(referenceImageBase64);
    }

    const fullPrompt = appendAspectRatioHint(prompt, aspectRatio);
    const { imageUrl, taskId, model } = await generateAdImageWithKie({
      prompt: fullPrompt,
      productImageUrls: productImageUrls.slice(0, 8),
      referenceImageUrl,
      aspectRatio,
      adVisualMode,
    });

    if (creationId && user?.id) {
      const admin = createAdminClient();
      await admin
        .from('creations')
        .update({ image_url: imageUrl, status: 'completed' })
        .eq('id', creationId)
        .eq('user_id', user.id);
    }

    return NextResponse.json({
      imageUrl,
      resultUrls: [imageUrl],
      taskId,
      model,
      adVisualMode,
      creationId: creationId ?? undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
