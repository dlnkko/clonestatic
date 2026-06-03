/** Download a public image URL and return a base64 data URL (for Gemini / prompt pipeline). */
export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Could not fetch image (${res.status})`);
  }
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
  const buf = Buffer.from(await res.arrayBuffer());
  const b64 = buf.toString('base64');
  return `data:${contentType};base64,${b64}`;
}
