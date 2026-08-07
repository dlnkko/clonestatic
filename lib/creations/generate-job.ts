import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdVisualMode } from '@/lib/ad-visual-mode';
import {
  generateAdImageWithKie,
  isKiePollTimeoutError,
  toUserFacingGenerationError,
} from '@/lib/kie';

export type AdImageGenerationParams = {
  prompt: string;
  productImageUrls: string[];
  aspectRatio: string;
  adVisualMode: AdVisualMode;
  creationId: string;
  userId: string;
  admin: SupabaseClient;
  aspectRatioHint?: string;
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
};

function appendAspectRatioHint(prompt: string, aspectRatio: string): string {
  if (aspectRatio === 'auto') return prompt;
  return `${prompt}\n\nTarget aspect ratio for the final image: ${aspectRatio}.`;
}

async function markCreationFailed(
  admin: SupabaseClient,
  creationId: string,
  userId: string,
  message: string
) {
  await admin
    .from('creations')
    .update({
      status: 'failed',
      error_message: message.slice(0, 2000),
    })
    .eq('id', creationId)
    .eq('user_id', userId);
}

export async function runAdImageGenerationJob(params: AdImageGenerationParams): Promise<void> {
  const {
    prompt,
    productImageUrls,
    aspectRatio,
    adVisualMode,
    creationId,
    userId,
    admin,
  } = params;

  try {
    const fullPrompt = appendAspectRatioHint(prompt, aspectRatio);
    const { imageUrl } = await generateAdImageWithKie({
      prompt: fullPrompt,
      productImageUrls,
      aspectRatio,
      adVisualMode,
      hasDedicatedLogo: params.hasDedicatedLogo,
      hasPersonInReference: params.hasPersonInReference,
      hasIllustrativeVisual: params.hasIllustrativeVisual,
      visualMedium: params.visualMedium,
      illustrationNotes: params.illustrationNotes,
      productUseProfile: params.productUseProfile,
      referenceHasPriceVisual: params.referenceHasPriceVisual,
      allowedPrice: params.allowedPrice,
      productBrandColors: params.productBrandColors,
      referenceProductVisibility: params.referenceProductVisibility,
      onTaskCreated: async (taskId) => {
        await admin
          .from('creations')
          .update({ kie_task_id: taskId })
          .eq('id', creationId)
          .eq('user_id', userId)
          .eq('status', 'generating');
      },
    });

    await admin
      .from('creations')
      .update({
        image_url: imageUrl,
        status: 'completed',
        error_message: null,
        kie_task_id: null,
      })
      .eq('id', creationId)
      .eq('user_id', userId);
  } catch (err) {
    // Job still running on Kie — keep "generating" so the next creations poll can attach the image.
    if (isKiePollTimeoutError(err)) {
      console.warn(
        `runAdImageGenerationJob: Kie still running for ${creationId}; leaving status=generating for UI sync`
      );
      return;
    }
    const message = toUserFacingGenerationError(err);
    console.error('runAdImageGenerationJob failed:', err);
    await markCreationFailed(admin, creationId, userId, message);
  }
}
