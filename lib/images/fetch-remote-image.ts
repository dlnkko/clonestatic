import { resolveProductImageFetchUrl } from '@/lib/products/media-url';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export function imageFetchHeaders(url: string): Record<string, string> {
  let referer = 'https://www.google.com/';
  try {
    const parsed = new URL(url);
    referer = /(?:^|\.)(?:ibb\.co|imgbb\.com)$/i.test(parsed.hostname)
      ? 'https://imgbb.com/'
      : `${parsed.origin}/`;
  } catch {
    // keep default
  }
  return {
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': BROWSER_UA,
    Referer: referer,
  };
}

export function isImageContentType(ct: string | null | undefined): boolean {
  if (!ct) return false;
  const main = ct.split(';')[0].trim().toLowerCase();
  return main.startsWith('image/');
}

export function sniffImageContentType(bytes: ArrayBuffer): string | null {
  const b = new Uint8Array(bytes.slice(0, 16));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

function extractOgImage(html: string): string | null {
  const og =
    html.match(/property=["']og:image(?::url)?["']\s+content=["']([^"']+)/i)?.[1] ??
    html.match(/content=["']([^"']+)["']\s+property=["']og:image(?::url)?["']/i)?.[1];
  if (og?.startsWith('http')) return og.replace(/&amp;/g, '&');
  const imgbb = html.match(/https?:\/\/i\.ibb\.co\/[^\s"'<>]+/i)?.[0];
  return imgbb ?? null;
}

export async function fetchRemoteImage(
  url: string,
  options?: { timeoutMs?: number; depth?: number }
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const depth = options?.depth ?? 0;
  const fetchUrl = depth === 0 ? await resolveProductImageFetchUrl(url) : url;

  const res = await fetch(fetchUrl, {
    headers: imageFetchHeaders(fetchUrl),
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch image (${res.status})`);
  }

  const body = await res.arrayBuffer();
  const headerCt = res.headers.get('content-type');
  const sniffed = sniffImageContentType(body);
  if (isImageContentType(headerCt) || sniffed) {
    const contentType = isImageContentType(headerCt)
      ? headerCt!.split(';')[0].trim()
      : sniffed || 'image/jpeg';
    return { body, contentType };
  }

  if (depth < 1) {
    const prefix = new TextDecoder().decode(body.slice(0, 80_000));
    if (/<html|og:image|ibb\.co/i.test(prefix)) {
      const next = extractOgImage(prefix);
      if (next && next !== fetchUrl) {
        return fetchRemoteImage(next, { timeoutMs, depth: depth + 1 });
      }
    }
  }

  throw new Error('URL did not return an image');
}
