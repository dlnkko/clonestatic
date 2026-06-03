/** Same-origin proxy so mobile browsers can display Kie/CDN URLs reliably. */
export function displayImageUrl(remoteUrl: string | null | undefined): string {
  if (!remoteUrl) return '';
  if (remoteUrl.startsWith('data:') || remoteUrl.startsWith('blob:')) return remoteUrl;
  if (remoteUrl.startsWith('/api/download-image')) return remoteUrl;
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
