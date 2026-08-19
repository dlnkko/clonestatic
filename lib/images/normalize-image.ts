import sharp from 'sharp';
import { fetchImageWithRetry } from '@/lib/fetch-image';
import { uploadBase64ToImgBB } from '@/lib/imgbb';

const KIE_SUPPORTED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif']);

const NEEDS_CONVERSION =
  /(?:^|\/)image\/(?:webp|avif|heic|heif|svg\+xml|bmp|tiff)|(?:^|\/)image\/(?:x-)?(?:webp|avif)/i;

export function mimeNeedsConversionForKie(mimeType: string): boolean {
  const mime = mimeType.toLowerCase().split(';')[0].trim();
  if (!mime.startsWith('image/')) return true;
  if (NEEDS_CONVERSION.test(mime)) return true;
  return !KIE_SUPPORTED.has(mime);
}

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) throw new Error('Invalid image data URL');
  return {
    mimeType: match[1].trim(),
    buffer: Buffer.from(match[2], 'base64'),
  };
}

const MAX_EDGE = 1280;
const MAX_OUTPUT_BYTES = 400_000;
const MIN_EDGE = 160;

export async function normalizeImageBuffer(
  input: Buffer,
  options?: { mimeHint?: string }
): Promise<{ buffer: Buffer; mimeType: 'image/jpeg' | 'image/png' }> {
  const meta = await sharp(input, {
    failOn: 'none',
    ...(options?.mimeHint?.includes('svg') ? { density: 300 } : {}),
  }).metadata();
  const keepAlpha = Boolean(meta.hasAlpha || options?.mimeHint?.includes('svg'));

  let edge = MAX_EDGE;
  let buffer: Buffer = input;
  let mimeType: 'image/jpeg' | 'image/png' = keepAlpha ? 'image/png' : 'image/jpeg';

  for (let i = 0; i < 8; i++) {
    const pipeline = sharp(input, {
      failOn: 'none',
      ...(options?.mimeHint?.includes('svg') ? { density: 300 } : {}),
    }).resize({
      width: edge,
      height: edge,
      fit: 'inside',
      withoutEnlargement: true,
    });

    if (keepAlpha) {
      buffer = await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
      mimeType = 'image/png';
    } else {
      buffer = await pipeline.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
      mimeType = 'image/jpeg';
    }

    if (buffer.length <= MAX_OUTPUT_BYTES || edge <= MIN_EDGE) break;
    edge = Math.max(MIN_EDGE, Math.round(edge * 0.7));
  }

  return { buffer, mimeType };
}

/** Convert/compress uploads for ImgBB. Always fits inside 1280px without stretching. */
export async function normalizeBase64DataUrl(dataUrl: string): Promise<string> {
  const { mimeType, buffer } = parseDataUrl(dataUrl);
  const normalized = await normalizeImageBuffer(buffer, { mimeHint: mimeType });
  return `data:${normalized.mimeType};base64,${normalized.buffer.toString('base64')}`;
}

async function rehostNormalizedUrl(url: string): Promise<string> {
  const fetched = await fetchImageWithRetry(url, { maxAttempts: 3, timeoutMs: 30_000 });
  if (!fetched) {
    throw new Error(`Could not download image for format conversion: ${url.slice(0, 80)}`);
  }
  const buffer = Buffer.from(fetched.buffer);
  if (!mimeNeedsConversionForKie(fetched.mimeType)) {
    return url;
  }
  const normalized = await normalizeImageBuffer(buffer, { mimeHint: fetched.mimeType });
  const dataUrl = `data:${normalized.mimeType};base64,${normalized.buffer.toString('base64')}`;
  return uploadBase64ToImgBB(dataUrl);
}

/** Ensure a remote URL points to JPEG/PNG/GIF before Kie image_input. Re-hosts via ImgBB when needed. */
export async function ensureKieCompatibleUrl(url: string): Promise<string> {
  if (!url.startsWith('http')) return url;

  const path = url.split('?')[0].toLowerCase();
  const extLooksOk = /\.(jpe?g|png|gif)$/i.test(path);
  const extLooksBad = /\.(webp|avif|heic|heif|svg|bmp|tiff)$/i.test(path);

  if (extLooksBad) {
    return rehostNormalizedUrl(url);
  }

  if (extLooksOk) {
    const fetched = await fetchImageWithRetry(url, { maxAttempts: 2, timeoutMs: 15_000 });
    if (fetched && !mimeNeedsConversionForKie(fetched.mimeType)) {
      return url;
    }
    if (fetched) {
      return rehostNormalizedUrl(url);
    }
    return url;
  }

  return rehostNormalizedUrl(url);
}

export async function ensureKieCompatibleUrls(urls: string[]): Promise<string[]> {
  const unique = [...new Set(urls.filter((u) => u.startsWith('http')))];
  const converted = await Promise.all(unique.map((u) => ensureKieCompatibleUrl(u)));
  const byOriginal = new Map(unique.map((u, i) => [u, converted[i] ?? u]));
  return urls.map((u) => byOriginal.get(u) ?? u);
}
