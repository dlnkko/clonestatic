import { normalizeBase64DataUrl } from '@/lib/images/normalize-image';

/** Upload base64 data URL to ImgBB and return public URL. Converts webp/avif to JPEG/PNG first. */
export async function uploadBase64ToImgBB(base64DataUrl: string): Promise<string> {
  const key = process.env.IMGBB_API_KEY;
  if (!key) {
    throw new Error('IMGBB_API_KEY is not set in .env.local');
  }
  const normalized = await normalizeBase64DataUrl(base64DataUrl);
  const base64Only = normalized.replace(/^data:image\/[^;]+;base64,/, '');
  const form = new FormData();
  form.set('key', key);
  form.set('image', base64Only);

  const res = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: form,
  });
  const json = await res.json();
  if (!json.success || !json.data?.url) {
    throw new Error(json?.error?.message || 'Failed to upload image to ImgBB');
  }
  return json.data.url as string;
}
