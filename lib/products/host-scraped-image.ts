import { uploadBase64ToImgBB } from '@/lib/imgbb';
import { fetchRemoteImage } from '@/lib/images/fetch-remote-image';
import { normalizeStoredImageUrl } from './media-url';

/** Fetch an external image URL and host on ImgBB for stable catalog storage. */
export async function hostExternalImageUrl(url: string): Promise<string> {
  const trimmed = normalizeStoredImageUrl(url);
  if (!trimmed.startsWith('http')) {
    return trimmed;
  }
  try {
    const { body, contentType } = await fetchRemoteImage(trimmed, { timeoutMs: 20_000 });
    const b64 = `data:${contentType};base64,${Buffer.from(body).toString('base64')}`;
    return await uploadBase64ToImgBB(b64);
  } catch {
    return trimmed;
  }
}

export async function hostExternalImageUrls(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const url of urls) {
    if (!url?.trim()) continue;
    try {
      out.push(await hostExternalImageUrl(url));
    } catch {
      const fallback = normalizeStoredImageUrl(url);
      if (fallback) out.push(fallback);
    }
  }
  return out;
}
