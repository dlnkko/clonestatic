import { NextRequest, NextResponse } from 'next/server';

/** Upload base64 image to ImgBB and return public URL. Used in parallel with prompt generation to save time. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productImageBase64 } = body as { productImageBase64?: string };
    if (!productImageBase64 || typeof productImageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid productImageBase64' },
        { status: 400 }
      );
    }

    const key = process.env.IMGBB_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: 'IMGBB_API_KEY is not set. Add it to .env.local' },
        { status: 503 }
      );
    }

    const base64Only = productImageBase64.replace(/^data:image\/\w+;base64,/, '');
    const form = new FormData();
    form.set('key', key);
    form.set('image', base64Only);

    const res = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: form,
    });
    const json = await res.json();
    if (!json.success || !json.data?.url) {
      return NextResponse.json(
        { error: json?.error?.message || 'Failed to upload image to ImgBB' },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: json.data.url as string });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
