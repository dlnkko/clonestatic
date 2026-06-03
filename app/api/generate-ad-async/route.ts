import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { useCreditForGeneration } from '@/lib/creations/use-credit';
import { runFullAdGenerationJob } from '@/lib/creations/full-generation-job';
import { checkRateLimit } from '@/lib/rate-limit';

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

function ownerEmail(): string {
  const fromEnv = process.env.OWNER_EMAIL?.trim()?.toLowerCase();
  return fromEnv && fromEnv.length > 0 ? fromEnv : 'diegolinaresd10@gmail.com';
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Start full ad generation (prompt + image) on the server — safe when mobile locks screen. */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit('generateStaticAd', request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', details: rateLimitResult.error },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      referenceImageUrl,
      productImageUrl,
      productImageUrls,
      productId,
      copywriting,
      copywritingUrl,
      guidelines,
      copyLanguage,
      aspectRatio: aspectRatioParam,
      creationId: creationIdParam,
    } = body as {
      referenceImageUrl?: string;
      productImageUrl?: string;
      productImageUrls?: string[];
      productId?: string;
      copywriting?: string | null;
      copywritingUrl?: string | null;
      guidelines?: string | null;
      copyLanguage?: string;
      aspectRatio?: string;
      creationId?: string;
    };

    if (!referenceImageUrl || !isValidHttpUrl(referenceImageUrl)) {
      return NextResponse.json({ error: 'referenceImageUrl is required' }, { status: 400 });
    }

    const hasProductId = typeof productId === 'string' && productId.trim().length > 0;
    const hasProductUrl =
      (typeof productImageUrl === 'string' && isValidHttpUrl(productImageUrl)) ||
      (Array.isArray(productImageUrls) &&
        productImageUrls.some((u) => typeof u === 'string' && isValidHttpUrl(u)));

    if (!hasProductId && !hasProductUrl) {
      return NextResponse.json(
        { error: 'productId or productImageUrl is required' },
        { status: 400 }
      );
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
        : '9:16';

    let creationId =
      typeof creationIdParam === 'string' && creationIdParam.trim()
        ? creationIdParam.trim()
        : null;

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
    } else {
      const { data: created, error: insertErr } = await admin
        .from('creations')
        .insert({
          user_id: user.id,
          image_url: null,
          aspect_ratio: aspectRatio,
          prompt: null,
          status: 'generating',
        })
        .select('id')
        .single();

      if (insertErr || !created?.id) {
        return NextResponse.json({ error: 'Could not start generation job' }, { status: 500 });
      }
      creationId = created.id as string;
    }

    const cookieHeader = request.headers.get('cookie') ?? '';
    const urls =
      Array.isArray(productImageUrls) && productImageUrls.length > 0
        ? productImageUrls.filter((u): u is string => typeof u === 'string' && isValidHttpUrl(u))
        : productImageUrl && isValidHttpUrl(productImageUrl)
          ? [productImageUrl]
          : [];

    after(async () => {
      try {
        await runFullAdGenerationJob({
          creationId: creationId!,
          userId: user.id,
          admin,
          cookieHeader,
          referenceImageUrl,
          productImageUrl: urls[0] ?? productImageUrl ?? null,
          productImageUrls: urls,
          productId: hasProductId ? productId!.trim() : null,
          copywriting: typeof copywriting === 'string' ? copywriting : null,
          copywritingUrl:
            typeof copywritingUrl === 'string' && isValidHttpUrl(copywritingUrl.trim())
              ? copywritingUrl.trim()
              : null,
          guidelines: typeof guidelines === 'string' ? guidelines : null,
          copyLanguage: typeof copyLanguage === 'string' ? copyLanguage : undefined,
          aspectRatio,
        });
      } catch (err) {
        console.error('generate-ad-async after() failed:', err);
      }
    });

    return NextResponse.json(
      {
        status: 'processing',
        creationId,
        message:
          'Your ad is generating on our servers (~2 min). You can lock your phone — it will appear in History.',
      },
      { status: 202 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to start generation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
