import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdVisualMode } from '@/lib/ad-visual-mode';
import { generateAdImageWithKie } from '@/lib/kie';

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
    });

    await admin
      .from('creations')
      .update({ image_url: imageUrl, status: 'completed', error_message: null })
      .eq('id', creationId)
      .eq('user_id', userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Image generation failed';
    console.error('runAdImageGenerationJob failed:', message, err);
    await markCreationFailed(admin, creationId, userId, message);
  }
}
