/** True if URL is likely loadable in <img src> (not an ImgBB HTML viewer page). */
export function isDirectImageUrl(url: string): boolean {
  if (!url?.startsWith('http')) return false;
  const base = url.split('?')[0];
  if (/^https?:\/\/(?:www\.)?ibb\.co\/[a-zA-Z0-9]+$/i.test(base)) return false;
  if (/i\.ibb\.co/i.test(url)) return true;
  if (/imgbb\.com\/images\//i.test(url)) return true;
  return /\.(jpe?g|png|gif|webp|svg)$/i.test(base);
}

/** Pick a direct image URL from an ImgBB upload API response. */
export function pickImgbbDirectUrl(data: Record<string, unknown>): string {
  const image = data.image as { url?: string } | undefined;
  const thumb = data.thumb as { url?: string } | undefined;
  const candidates = [
    typeof data.display_url === 'string' ? data.display_url : null,
    image?.url,
    typeof data.url === 'string' ? data.url : null,
    thumb?.url,
  ].filter((u): u is string => typeof u === 'string' && u.trim().length > 0);

  for (const u of candidates) {
    if (isDirectImageUrl(u)) return u;
  }

  throw new Error('ImgBB did not return a direct image URL');
}

export function normalizeStoredImageUrl(url: string | null | undefined): string {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) return '';
  return trimmed;
}

/** Resolve ImgBB viewer pages (ibb.co/xxx) to direct i.ibb.co image URL. */
export async function resolveImgbbViewerUrl(url: string): Promise<string> {
  if (!/^https?:\/\/(?:www\.)?ibb\.co\/[a-zA-Z0-9]+(?:\/|$|\?)/i.test(url)) {
    return url;
  }
  if (isDirectImageUrl(url)) return url;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'admirror/1.0', Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return url;
    const html = await res.text();
    const og =
      html.match(/property=["']og:image(?::url)?["']\s+content=["']([^"']+)/i)?.[1] ??
      html.match(/content=["']([^"']+)["']\s+property=["']og:image(?::url)?["']/i)?.[1];
    if (og?.startsWith('http') && isDirectImageUrl(og)) return og;
  } catch {
    // fall through
  }
  return url;
}

export async function resolveProductImageFetchUrl(url: string): Promise<string> {
  if (!url.startsWith('http')) return url;
  return resolveImgbbViewerUrl(url);
}
