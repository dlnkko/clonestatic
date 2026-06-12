import { uploadBase64ToImgBB } from '@/lib/imgbb';
import { classifyProductImagesHeuristic } from './classify-images';
import { primaryProductImageUrl } from './prepare-catalog';
import type { ProductImage, ProductImageKind } from './types';

export type ProductImageSlotInput =
  | { url: string; kind?: ProductImageKind; alt?: string }
  | { base64: string; kind?: ProductImageKind; alt?: string };

export async function resolveProductImageSlots(
  slots: ProductImageSlotInput[],
  productName: string
): Promise<{ images: ProductImage[]; logo_url: string | null; primary_image_url: string }> {
  const images: ProductImage[] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if ('url' in slot && slot.url?.startsWith('http')) {
      images.push({
        url: slot.url.trim(),
        kind: slot.kind,
        alt: slot.alt ?? `${productName} image ${i + 1}`,
      });
      continue;
    }
    if ('base64' in slot && slot.base64) {
      const url = await uploadBase64ToImgBB(slot.base64);
      images.push({
        url,
        kind: slot.kind,
        alt: slot.alt ?? `${productName} image ${i + 1}`,
      });
    }
  }

  const classified = classifyProductImagesHeuristic(images);
  const primary = primaryProductImageUrl(classified);
  if (!primary) {
    throw new Error('At least one product image is required');
  }

  const logo_url = classified.find((img) => img.kind === 'logo')?.url ?? null;

  return { images: classified, logo_url, primary_image_url: primary };
}
