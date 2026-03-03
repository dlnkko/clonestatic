import { NextRequest, NextResponse } from 'next/server';

/** Proxies an image and returns it with Content-Disposition: attachment so mobile browsers trigger download. */
function isValidImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function isImageContentType(ct: string | null): boolean {
  if (!ct) return false;
  const main = ct.split(';')[0].trim().toLowerCase();
  return main === 'image/jpeg' || main === 'image/jpg' || main === 'image/png' || main === 'image/webp' || main === 'image/gif' || main.startsWith('image/');
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const filename = request.nextUrl.searchParams.get('filename') || 'generated-ad.jpg';

  if (!url || !isValidImageUrl(url)) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: 'image/*' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
    }
    const contentType = res.headers.get('content-type');
    if (!isImageContentType(contentType)) {
      return NextResponse.json({ error: 'URL did not return an image' }, { status: 400 });
    }
    const blob = await res.arrayBuffer();

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Content-Disposition': `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('download-image proxy error:', e);
    return NextResponse.json({ error: 'Download failed' }, { status: 502 });
  }
}
