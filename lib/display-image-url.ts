/** Same-origin proxy so mobile browsers can display Kie/CDN URLs reliably. */
export function shouldBypassImageProxy(url: string): boolean {
  if (!url.startsWith('http')) return true;
  if (/^https?:\/\/i\.ibb\.co\//i.test(url)) return true;
  if (/imgbb\.com\/images\//i.test(url)) return true;
  // Common product CDNs load fine (and faster) without our proxy.
  if (/cdn\.shopify\.com/i.test(url)) return true;
  if (/cloudinary\.com/i.test(url)) return true;
  if (/images\.unsplash\.com/i.test(url)) return true;
  return false;
}

export function displayImageUrl(remoteUrl: string | null | undefined): string {
  if (!remoteUrl) return '';
  if (remoteUrl.startsWith('data:') || remoteUrl.startsWith('blob:')) return remoteUrl;
  if (remoteUrl.startsWith('/api/download-image')) return remoteUrl;
  if (shouldBypassImageProxy(remoteUrl)) return remoteUrl;
  return `/api/download-image?url=${encodeURIComponent(remoteUrl)}&display=1`;
}

export function isTransientFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError') return true;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('the internet connection appears to be offline') ||
    msg.includes('aborted') ||
    msg.includes('cancelled')
  );
}
