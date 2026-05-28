import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runAdImageGenerationJob } from '@/lib/creations/generate-job';
import { useCreditForGeneration } from '@/lib/creations/use-credit';
import { uploadBase64ToImgBB } from '@/lib/imgbb';
import type { AdVisualMode } from '@/lib/ad-visual-mode';
import { generateAdImageWithKie } from '@/lib/kie';

export const maxDuration = 300;

const ALLOWED_RATIOS = [
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
] as const;

function appendAspectRatioHint(prompt: string, aspectRatio: string): string {
  if (aspectRatio === 'auto') return prompt;
  return `${prompt}\n\nTarget aspect ratio for the final image: ${aspectRatio}.`;
}

function ownerEmail(): string {
  const fromEnv = process.env.OWNER_EMAIL?.trim()?.toLowerCase();
  return fromEnv && fromEnv.length > 0 ? fromEnv : 'diegolinaresd10@gmail.com';
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
    if (authError || !user?.email || !user.id) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    const email = user.email.trim().toLowerCase();
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const isOwner = email === ownerEmail();
    const admin = createAdminClient();
    const credit = await useCreditForGeneration(request, admin, email, isOwner);
    if (!credit.ok) {
      return NextResponse.json(
        { error: credit.error, credits_remaining: credit.credits_remaining },
        { status: credit.status }
      );
    }

    const aspectRatio =
      typeof aspectRatioParam === 'string' &&
      (ALLOWED_RATIOS as readonly string[]).includes(aspectRatioParam)
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

    if (creationId) {
      const { data: row } = await admin
        .from('creations')
        .select('id, status')
        .eq('id', creationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!row) {
        return NextResponse.json({ error: 'Invalid creationId' }, { status: 400 });
      }

      after(async () => {
        await runAdImageGenerationJob({
          prompt,
          productImageUrls,
          referenceImageUrl,
          aspectRatio,
          adVisualMode,
          creationId,
          userId: user.id,
          admin,
        });
      });

      return NextResponse.json(
        {
          status: 'processing',
          creationId,
          message: 'Image generation started in the background.',
        },
        { status: 202 }
      );
    }

    const fullPrompt = appendAspectRatioHint(prompt, aspectRatio);
    const { imageUrl, taskId, model } = await generateAdImageWithKie({
      prompt: fullPrompt,
      productImageUrls: productImageUrls.slice(0, 8),
      referenceImageUrl,
      aspectRatio,
      adVisualMode,
    });

    return NextResponse.json({
      status: 'completed',
      imageUrl,
      resultUrls: [imageUrl],
      taskId,
      model,
      adVisualMode,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
