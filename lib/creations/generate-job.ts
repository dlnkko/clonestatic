import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdVisualMode } from '@/lib/ad-visual-mode';
import { generateAdImageWithKie, editImageWithKie } from '@/lib/kie';

export type AdImageGenerationParams = {
  prompt: string;
  productImageUrls: string[];
  referenceImageUrl: string | null;
  aspectRatio: string;
  adVisualMode: AdVisualMode;
  creationId: string;
  userId: string;
  admin: SupabaseClient;
  aspectRatioHint?: string;
};

function appendAspectRatioHint(prompt: string, aspectRatio: string): string {
  if (aspectRatio === 'auto') return prompt;
  return `${prompt}\n\nTarget aspect ratio for the final image: ${aspectRatio}.`;
}

export async function runAdImageGenerationJob(params: AdImageGenerationParams): Promise<void> {
  const {
    prompt,
    productImageUrls,
    referenceImageUrl,
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
      productImageUrls: productImageUrls.slice(0, 8),
      referenceImageUrl,
      aspectRatio,
      adVisualMode,
    });

    await admin
      .from('creations')
      .update({ image_url: imageUrl, status: 'completed' })
      .eq('id', creationId)
      .eq('user_id', userId);
  } catch (err) {
    console.error('runAdImageGenerationJob failed:', err);
    await admin
      .from('creations')
      .update({ status: 'failed' })
      .eq('id', creationId)
      .eq('user_id', userId);
  }
}

export type EditImageGenerationParams = {
  prompt: string;
  sourceImageUrl: string;
  aspectRatio: string;
  creationId: string;
  userId: string;
  admin: SupabaseClient;
};

export async function runEditImageGenerationJob(params: EditImageGenerationParams): Promise<void> {
  const { prompt, sourceImageUrl, aspectRatio, creationId, userId, admin } = params;

  try {
    const fullPrompt = appendAspectRatioHint(prompt, aspectRatio);
    const { imageUrl } = await editImageWithKie({
      prompt: fullPrompt,
      imageUrl: sourceImageUrl,
      aspectRatio,
    });

    await admin
      .from('creations')
      .update({ image_url: imageUrl, status: 'completed' })
      .eq('id', creationId)
      .eq('user_id', userId);
  } catch (err) {
    console.error('runEditImageGenerationJob failed:', err);
    await admin
      .from('creations')
      .update({ status: 'failed' })
      .eq('id', creationId)
      .eq('user_id', userId);
  }
}
