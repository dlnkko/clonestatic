import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runAdImageGenerationJob } from '@/lib/creations/generate-job';
import { useCreditForGeneration } from '@/lib/creations/use-credit';
import { uploadBase64ToImgBB } from '@/lib/imgbb';
import type { AdVisualMode } from '@/lib/ad-visual-mode';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      productImageBase64,
      productImageUrl: productImageUrlParam,
      productImageUrls: productImageUrlsParam,
      aspectRatio: aspectRatioParam,
      adVisualMode: adVisualModeParam,
      creationId: creationIdParam,
      hasDedicatedLogo: hasDedicatedLogoParam,
      hasPersonInReference: hasPersonInReferenceParam,
      hasIllustrativeVisual: hasIllustrativeVisualParam,
      visualMedium: visualMediumParam,
      illustrationNotes: illustrationNotesParam,
      productUseProfile: productUseProfileParam,
      referenceHasPriceVisual: referenceHasPriceVisualParam,
      allowedPrice: allowedPriceParam,
      productBrandColors: productBrandColorsParam,
    } = body as {
      prompt?: string;
      productImageBase64?: string;
      productImageUrl?: string;
      productImageUrls?: string[];
      aspectRatio?: string;
      adVisualMode?: AdVisualMode;
      creationId?: string;
      hasDedicatedLogo?: boolean;
      hasPersonInReference?: boolean;
      hasIllustrativeVisual?: boolean;
      visualMedium?: string;
      illustrationNotes?: string;
      productUseProfile?: import('@/lib/products/infer-product-use').ProductUseProfile | null;
      referenceHasPriceVisual?: boolean;
      allowedPrice?: string | null;
      productBrandColors?: string[];
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

    // Always run Kie on the server after responding — works when mobile locks / tab backgrounds.
    let jobCreationId = creationId;

    if (jobCreationId) {
      const { data: row } = await admin
        .from('creations')
        .select('id, status')
        .eq('id', jobCreationId)
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
          prompt,
          status: 'generating',
        })
        .select('id')
        .single();

      if (insertErr || !created?.id) {
        console.error('generate-ad-image: could not create creation row', insertErr);
        return NextResponse.json(
          { error: 'Could not start background job. Try again.' },
          { status: 500 }
        );
      }
      jobCreationId = created.id as string;
    }

    if (!jobCreationId) {
      return NextResponse.json({ error: 'Could not start background job.' }, { status: 500 });
    }

    const backgroundParams = {
      prompt,
      productImageUrls,
      aspectRatio,
      adVisualMode,
      creationId: jobCreationId,
      userId: user.id,
      admin,
      hasDedicatedLogo: hasDedicatedLogoParam === true,
      hasPersonInReference: hasPersonInReferenceParam === true,
      hasIllustrativeVisual: hasIllustrativeVisualParam === true,
      visualMedium:
        typeof visualMediumParam === 'string' && visualMediumParam.trim()
          ? visualMediumParam.trim()
          : undefined,
      illustrationNotes:
        typeof illustrationNotesParam === 'string' && illustrationNotesParam.trim()
          ? illustrationNotesParam.trim()
          : undefined,
      productUseProfile: productUseProfileParam ?? null,
      referenceHasPriceVisual: referenceHasPriceVisualParam === true,
      allowedPrice:
        typeof allowedPriceParam === 'string' && allowedPriceParam.trim()
          ? allowedPriceParam.trim()
          : null,
      productBrandColors: Array.isArray(productBrandColorsParam)
        ? productBrandColorsParam.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
        : [],
    };

    after(async () => {
      try {
        await runAdImageGenerationJob(backgroundParams);
      } catch (err) {
        console.error('generate-ad-image after() job failed:', err);
      }
    });

    return NextResponse.json(
      {
        status: 'processing',
        creationId: jobCreationId,
        message:
          'Getting your ad ready — check History when it finishes.',
      },
      { status: 202 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
