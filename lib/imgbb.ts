import { normalizeBase64DataUrl } from '@/lib/images/normalize-image';
import { pickImgbbDirectUrl } from '@/lib/products/media-url';

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) throw new Error('Invalid image data URL');
  return {
    mimeType: match[1].trim(),
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function friendlyImgbbError(raw: string): never {
  if (/unexpected token|not valid json|<!doctype|<html|body exceeded|too large/i.test(raw)) {
    throw new Error('Could not upload that image. Try a smaller PNG or JPEG.');
  }
  throw new Error(raw || 'Could not upload that image. Please try again.');
}

/** Upload a compressed image buffer to ImgBB as a binary file (not a giant JSON/base64 body). */
export async function uploadImageBufferToImgBB(buffer: Buffer, mimeType: string): Promise<string> {
  const key = process.env.IMGBB_API_KEY;
  if (!key) {
    throw new Error('Image upload is not configured');
  }

  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('gif') ? 'gif' : 'jpg';
  const form = new FormData();
  form.set('key', key);
  form.set(
    'image',
    new File([new Uint8Array(buffer)], `image.${ext}`, { type: mimeType || `image/${ext}` })
  );

  const res = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: form,
  });
  const text = await res.text();
  let json: { success?: boolean; data?: Record<string, unknown>; error?: { message?: string } };
  try {
    json = text ? (JSON.parse(text) as typeof json) : {};
  } catch {
    friendlyImgbbError(text.slice(0, 180));
  }
  if (!json.success || !json.data) {
    friendlyImgbbError(json.error?.message || `ImgBB upload failed (${res.status})`);
  }
  return pickImgbbDirectUrl(json.data);
}

/** Upload base64 data URL to ImgBB and return public URL. Converts webp/avif to JPEG/PNG first. */
export async function uploadBase64ToImgBB(base64DataUrl: string): Promise<string> {
  const normalized = await normalizeBase64DataUrl(base64DataUrl);
  const { mimeType, buffer } = parseDataUrl(normalized);
  return uploadImageBufferToImgBB(buffer, mimeType);
}
