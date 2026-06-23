import { uploadBase64ToImgBB } from '@/lib/imgbb';

/** Fetch an external image URL and host on ImgBB for stable catalog storage. */
export async function hostExternalImageUrl(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed.startsWith('http')) {
    throw new Error('Invalid image URL');
  }
  try {
    const res = await fetch(trimmed, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return trimmed;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    const b64 = `data:${contentType};base64,${buf.toString('base64')}`;
    return await uploadBase64ToImgBB(b64);
  } catch {
    return trimmed;
  }
}

export async function hostExternalImageUrls(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const url of urls) {
    if (!url?.trim()) continue;
    out.push(await hostExternalImageUrl(url));
  }
  return out;
}
