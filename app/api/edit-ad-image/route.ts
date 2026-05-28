import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runEditImageGenerationJob } from '@/lib/creations/generate-job';
import { useCreditForGeneration } from '@/lib/creations/use-credit';
import { uploadBase64ToImgBB } from '@/lib/imgbb';
import { editImageWithKie } from '@/lib/kie';

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
      imageBase64,
      aspectRatio: aspectRatioParam,
      creationId: creationIdParam,
    } = body as {
      prompt?: string;
      imageBase64?: string;
      aspectRatio?: string;
      creationId?: string;
    };

    const creationId =
      typeof creationIdParam === 'string' && creationIdParam.trim()
        ? creationIdParam.trim()
        : null;

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

    const sourceImageUrl = await uploadBase64ToImgBB(imageBase64);

    if (creationId) {
      const { data: row } = await admin
        .from('creations')
        .select('id')
        .eq('id', creationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!row) {
        return NextResponse.json({ error: 'Invalid creationId' }, { status: 400 });
      }

      after(async () => {
        await runEditImageGenerationJob({
          prompt,
          sourceImageUrl,
          aspectRatio,
          creationId,
          userId: user.id,
          admin,
        });
      });

      return NextResponse.json(
        {
          status: 'processing',
          creationId,
          message: 'Edit started in the background.',
        },
        { status: 202 }
      );
    }

    const fullPrompt = appendAspectRatioHint(prompt, aspectRatio);
    const { imageUrl: outUrl, taskId } = await editImageWithKie({
      prompt: fullPrompt,
      imageUrl: sourceImageUrl,
      aspectRatio,
    });

    return NextResponse.json({
      status: 'completed',
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
