const MAX_JPEG_BYTES = 200_000;
const MAX_PNG_BYTES = 250_000;
const MIN_DIM = 160;

function scaleToMax(w: number, h: number, maxDim: number): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 1, h: 1 };
  if (w <= maxDim && h <= maxDim) return { w, h };
  if (w > h) return { w: maxDim, h: Math.max(1, Math.round((h * maxDim) / w)) };
  return { w: Math.max(1, Math.round((w * maxDim) / h)), h: maxDim };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Read failed'));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Failed to compress image'));
      else resolve(blob);
    }, mime, quality);
  });
}

function wantsAlpha(file: File, keepAlpha?: boolean): boolean {
  if (keepAlpha != null) return keepAlpha;
  return /png|svg|webp/i.test(file.type) || /\.(png|svg|webp)$/i.test(file.name);
}

/**
 * Shrink any image that is too wide, too tall, or too heavy.
 * Aspect ratio is preserved (never stretched).
 */
export async function compressFileToBlob(
  file: File,
  options?: { keepAlpha?: boolean }
): Promise<Blob> {
  const keepAlpha = wantsAlpha(file, options?.keepAlpha);
  const mime = keepAlpha ? 'image/png' : 'image/jpeg';
  const maxBytes = keepAlpha ? MAX_PNG_BYTES : MAX_JPEG_BYTES;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read that image. Try a PNG or JPEG.'));
    };
    image.src = objectUrl;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const startMax = keepAlpha ? 640 : 1280;
  let { w, h } = scaleToMax(img.naturalWidth, img.naturalHeight, startMax);
  let quality = 0.8;
  let blob: Blob | null = null;

  for (let i = 0; i < 12; i++) {
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    if (!keepAlpha) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    blob = await canvasToBlob(canvas, mime, quality);
    if (blob.size <= maxBytes) return blob;

    if (!keepAlpha && quality > 0.42) {
      quality = Math.max(0.42, quality - 0.1);
      continue;
    }

    const longSide = Math.max(w, h);
    if (longSide <= MIN_DIM) break;
    ({ w, h } = scaleToMax(w, h, Math.max(MIN_DIM, Math.round(longSide * 0.7))));
  }

  if (!blob) throw new Error('Failed to compress image');
  return blob;
}

export async function compressFileToDataUrl(
  file: File,
  options?: { keepAlpha?: boolean }
): Promise<string> {
  const blob = await compressFileToBlob(file, options);
  return blobToDataUrl(blob);
}

export async function compressFileToFile(
  file: File,
  options?: { keepAlpha?: boolean }
): Promise<File> {
  const blob = await compressFileToBlob(file, options);
  const ext = blob.type === 'image/png' ? 'png' : 'jpg';
  const base = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${base}.${ext}`, { type: blob.type });
}

export async function parseFetchJson<T = Record<string, unknown>>(
  res: Response
): Promise<{ data: T; error: string | null }> {
  const text = await res.text();
  try {
    return { data: (text ? JSON.parse(text) : {}) as T, error: null };
  } catch {
    if (res.status === 413 || text.startsWith('<') || text.includes('<!DOCTYPE')) {
      return { data: {} as T, error: 'That file is too large. Try a smaller PNG or JPEG.' };
    }
    if (res.status === 504 || res.status === 408) {
      return { data: {} as T, error: 'Upload timed out. Try a smaller image.' };
    }
    return { data: {} as T, error: 'Could not save. Please try again.' };
  }
}

export function userFacingUploadError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Could not save. Please try again.';
  if (/unexpected token|not valid json|<!doctype|<html|body exceeded|too large|413/i.test(message)) {
    return 'Could not upload that image. Try a smaller PNG or JPEG.';
  }
  return message;
}

export async function uploadProductImageFile(
  file: File,
  options?: { keepAlpha?: boolean }
): Promise<string> {
  const compressed = await compressFileToFile(file, options);
  const form = new FormData();
  form.set('file', compressed);
  const res = await fetch('/api/upload-product-image', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  const { data, error } = await parseFetchJson<{ url?: string; error?: string }>(res);
  if (error) throw new Error(error);
  if (!res.ok || !data.url) {
    throw new Error(userFacingUploadError(data.error || 'Upload failed'));
  }
  return data.url;
}

export async function uploadProductImageDataUrl(dataUrl: string): Promise<string> {
  const res = await fetch('/api/upload-product-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ productImageBase64: dataUrl }),
  });
  const { data, error } = await parseFetchJson<{ url?: string; error?: string }>(res);
  if (error) throw new Error(error);
  if (!res.ok || !data.url) {
    throw new Error(userFacingUploadError(data.error || 'Upload failed'));
  }
  return data.url;
}
