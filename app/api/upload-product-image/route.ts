import { NextRequest, NextResponse } from 'next/server';
import { uploadBase64ToImgBB } from '@/lib/imgbb';

export const maxDuration = 30;

/** Upload base64 image to ImgBB and return public URL. Used in parallel with prompt generation to save time. */
export async function POST(request: NextRequest) {
  try {
    let body: { productImageBase64?: string };
    try {
      body = (await request.json()) as { productImageBase64?: string };
    } catch {
      return NextResponse.json(
        { error: 'That file is too large. Try a smaller PNG or JPEG.' },
        { status: 413 }
      );
    }
    const { productImageBase64 } = body;
    if (!productImageBase64 || typeof productImageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid productImageBase64' },
        { status: 400 }
      );
    }

    const url = await uploadBase64ToImgBB(productImageBase64);
    return NextResponse.json({ url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
