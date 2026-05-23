import { NextRequest, NextResponse } from 'next/server';
import { uploadBase64ToImgBB } from '@/lib/imgbb';

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

    const url = await uploadBase64ToImgBB(productImageBase64);
    return NextResponse.json({ url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
