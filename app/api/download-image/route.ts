import { NextRequest, NextResponse } from 'next/server';

/** Proxies an image and returns it with Content-Disposition: attachment so mobile browsers trigger download. */
const ALLOWED_HOSTS = [
  'replicate.delivery',
  'pbxt.replicate.delivery',
  'replicate.com',
  'imgbb.com',
  'i.ibb.co',
  'ibb.co',
  'kie.ai',
  'localhost',
];

function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith('.' + allowed));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const filename = request.nextUrl.searchParams.get('filename') || 'generated-ad.jpg';

  if (!url || !isAllowedUrl(url)) {
    return NextResponse.json({ error: 'Invalid or disallowed URL' }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: 'image/*' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const blob = await res.arrayBuffer();

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('download-image proxy error:', e);
    return NextResponse.json({ error: 'Download failed' }, { status: 502 });
  }
}
