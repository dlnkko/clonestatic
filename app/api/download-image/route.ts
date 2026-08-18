import { NextRequest, NextResponse } from 'next/server';
import { fetchRemoteImage } from '@/lib/images/fetch-remote-image';

/** Proxies an image and returns it with Content-Disposition: attachment so mobile browsers trigger download. */
function isValidImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const filename = request.nextUrl.searchParams.get('filename') || 'generated-ad.jpg';

  if (!url || !isValidImageUrl(url)) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const inline = request.nextUrl.searchParams.get('display') === '1';
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fetchTimeoutMs = inline ? 15_000 : 120_000;

  try {
    const { body, contentType } = await fetchRemoteImage(url, { timeoutMs: fetchTimeoutMs });

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Content-Disposition': inline
          ? 'inline'
          : `attachment; filename="${safeName}"`,
        'Cache-Control': inline ? 'public, max-age=3600' : 'no-store',
      },
    });
  } catch (e) {
    console.error('download-image proxy error:', e);
    return NextResponse.json({ error: 'Download failed' }, { status: 502 });
  }
}
