import { NextRequest, NextResponse } from 'next/server';
import { uploadImageBufferToImgBB } from '@/lib/imgbb';
import { normalizeImageBuffer } from '@/lib/images/normalize-image';

export const maxDuration = 30;
export const runtime = 'nodejs';

function userUploadError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Upload failed';
  if (/unexpected token|not valid json|<!doctype|<html|body exceeded|too large|413/i.test(message)) {
    return 'Could not upload that image. Try a smaller PNG or JPEG.';
  }
  return message;
}

async function bufferFromRequest(request: NextRequest): Promise<{ buffer: Buffer; mimeHint: string } | NextResponse> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing image file' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    return { buffer, mimeHint: file.type || 'image/png' };
  }

  let body: { productImageBase64?: string };
  try {
    body = (await request.json()) as { productImageBase64?: string };
  } catch {
    return NextResponse.json(
      { error: 'Could not upload that image. Try a smaller PNG or JPEG.' },
      { status: 413 }
    );
  }
  const { productImageBase64 } = body;
  if (!productImageBase64 || typeof productImageBase64 !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid productImageBase64' }, { status: 400 });
  }
  const mimeHint = productImageBase64.match(/^data:([^;]+);/)?.[1] || 'image/png';
  const base64 = productImageBase64.replace(/^data:[^;]+;base64,/, '');
  return { buffer: Buffer.from(base64, 'base64'), mimeHint };
}

/** Upload a product/logo image and return a public URL. */
export async function POST(request: NextRequest) {
  try {
    const parsed = await bufferFromRequest(request);
    if (parsed instanceof NextResponse) return parsed;

    const { buffer, mimeHint } = parsed;
    if (!buffer.length) {
      return NextResponse.json({ error: 'Missing image file' }, { status: 400 });
    }
    if (buffer.length > 8_000_000) {
      return NextResponse.json(
        { error: 'That file is too large. Try a smaller PNG or JPEG.' },
        { status: 413 }
      );
    }

    const normalized = await normalizeImageBuffer(buffer, { mimeHint });
    const url = await uploadImageBufferToImgBB(normalized.buffer, normalized.mimeType);
    return NextResponse.json({ url });
  } catch (err: unknown) {
    return NextResponse.json({ error: userUploadError(err) }, { status: 500 });
  }
}
