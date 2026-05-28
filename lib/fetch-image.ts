const RETRYABLE =
  /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed|network/i;

function backoffMs(attempt: number): number {
  return Math.min(8000, 600 * 2 ** (attempt - 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type FetchedImage = {
  buffer: ArrayBuffer;
  mimeType: string;
};

/**
 * Download a remote image with retries. Returns null instead of throwing so callers can skip bad URLs.
 */
export async function fetchImageWithRetry(
  url: string,
  options: { maxAttempts?: number; timeoutMs?: number } = {}
): Promise<FetchedImage | null> {
  const maxAttempts = options.maxAttempts ?? 4;
  const timeoutMs = options.timeoutMs ?? 45_000;

  if (!url.startsWith('http')) return null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });

      if (!res.ok) {
        const retry = res.status >= 500 || res.status === 429;
        console.warn(
          `[fetchImage] HTTP ${res.status} for ${url.slice(0, 100)} (attempt ${attempt}/${maxAttempts})`
        );
        if (retry && attempt < maxAttempts) {
          await sleep(backoffMs(attempt));
          continue;
        }
        return null;
      }

      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const mimeType = contentType.split(';')[0].trim();
      const buffer = await res.arrayBuffer();

      if (buffer.byteLength < 128) {
        console.warn(`[fetchImage] empty body for ${url.slice(0, 100)}`);
        return null;
      }

      return { buffer, mimeType };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const cause =
        err instanceof Error && err.cause instanceof Error
          ? err.cause.message
          : '';
      const retryable = RETRYABLE.test(`${msg} ${cause}`);

      console.warn(
        `[fetchImage] attempt ${attempt}/${maxAttempts} failed (${retryable ? 'retry' : 'skip'}): ${url.slice(0, 100)} — ${msg}${cause ? ` / ${cause}` : ''}`
      );

      if (retryable && attempt < maxAttempts) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return null;
    }
  }

  return null;
}
