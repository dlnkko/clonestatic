import { createAdminClient } from '@/lib/supabase/admin';

export const STATIC_AD_BUCKET = 'static-ad-library';

export function staticAdStoragePath(periodKey: string, adArchiveId: string, ext = 'jpg'): string {
  const safeId = adArchiveId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return `${periodKey}/${safeId}.${ext}`;
}

export function publicStorageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!base) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  return `${base}/storage/v1/object/public/${STATIC_AD_BUCKET}/${path}`;
}

export function extensionFromMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  return 'jpg';
}

export async function uploadStaticAdImage(
  path: string,
  buffer: ArrayBuffer,
  mimeType: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(STATIC_AD_BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}
