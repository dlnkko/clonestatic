const MAX_JPEG_BYTES = 280_000;
const MAX_PNG_BYTES = 900_000;

function scaleToMax(w: number, h: number, maxDim: number): { w: number; h: number } {
  if (w <= maxDim && h <= maxDim) return { w, h };
  if (w > h) return { w: maxDim, h: Math.round((h * maxDim) / w) };
  return { w: Math.round((w * maxDim) / h), h: maxDim };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Read failed'));
    reader.readAsDataURL(blob);
  });
}

/** Browser-side compress so uploads stay under Vercel’s body limit. Logos keep PNG alpha. */
export function compressFileToDataUrl(
  file: File,
  options?: { keepAlpha?: boolean }
): Promise<string> {
  const keepAlpha =
    options?.keepAlpha ??
    (/png|svg|webp/i.test(file.type) || /\.(png|svg|webp)$/i.test(file.name));
  const maxDim = keepAlpha ? 1024 : 1920;
  const mime = keepAlpha ? 'image/png' : 'image/jpeg';
  const maxBytes = keepAlpha ? MAX_PNG_BYTES : MAX_JPEG_BYTES;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const sized = scaleToMax(img.naturalWidth, img.naturalHeight, maxDim);
      const canvas = document.createElement('canvas');
      canvas.width = sized.w;
      canvas.height = sized.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, sized.w, sized.h);

      const encode = (quality: number, dim: number): Promise<string> =>
        new Promise((res, rej) => {
          if (dim < sized.w || dim < sized.h) {
            const next = scaleToMax(img.naturalWidth, img.naturalHeight, dim);
            canvas.width = next.w;
            canvas.height = next.h;
            ctx.clearRect(0, 0, next.w, next.h);
            ctx.drawImage(img, 0, 0, next.w, next.h);
          }
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                rej(new Error('Failed to compress image'));
                return;
              }
              if (blob.size <= maxBytes || (keepAlpha && dim <= 512) || (!keepAlpha && quality <= 0.2)) {
                blobToDataUrl(blob).then(res).catch(rej);
                return;
              }
              if (keepAlpha) {
                encode(quality, Math.max(512, Math.round(dim * 0.75))).then(res).catch(rej);
                return;
              }
              encode(Math.max(0.2, quality - 0.15), dim).then(res).catch(rej);
            },
            mime,
            quality
          );
        });

      encode(keepAlpha ? 1 : 0.9, maxDim).then(resolve).catch(reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      if (file.size <= maxBytes) {
        blobToDataUrl(file).then(resolve).catch(reject);
        return;
      }
      reject(new Error('Could not read that image. Try a smaller PNG or JPEG.'));
    };
    img.src = objectUrl;
  });
}

export async function parseFetchJson<T = Record<string, unknown>>(
  res: Response
): Promise<{ data: T; error: string | null }> {
  const text = await res.text();
  try {
    return { data: (text ? JSON.parse(text) : {}) as T, error: null };
  } catch {
    if (res.status === 413) {
      return { data: {} as T, error: 'That file is too large. Try a smaller PNG or JPEG.' };
    }
    if (res.status === 504 || res.status === 408) {
      return { data: {} as T, error: 'Upload timed out. Try a smaller image.' };
    }
    if (text.startsWith('<') || text.includes('<!DOCTYPE')) {
      return { data: {} as T, error: 'That file is too large. Try a smaller PNG or JPEG.' };
    }
    return { data: {} as T, error: 'Could not save. Please try again.' };
  }
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
    throw new Error(typeof data.error === 'string' ? data.error : 'Upload failed');
  }
  return data.url;
}
