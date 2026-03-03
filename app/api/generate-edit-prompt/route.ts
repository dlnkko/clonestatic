import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

function getGoogleGenAI() {
  const key = process.env.GOOGLE_GENAI_API_KEY;
  if (!key) throw new Error('GOOGLE_GENAI_API_KEY is not set');
  return new GoogleGenAI({ apiKey: key });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, instructions } = body as { imageBase64?: string; instructions?: string };
    if (!imageBase64 || typeof imageBase64 !== 'string' || !instructions || typeof instructions !== 'string') {
      return NextResponse.json({ error: 'imageBase64 and instructions are required' }, { status: 400 });
    }

    const ai = getGoogleGenAI();
    const base64Only = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const mimeMatch = imageBase64.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const buffer = Buffer.from(base64Only, 'base64');
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });

    const uploaded = await ai.files.upload({ file: blob, config: { mimeType } });
    if (!uploaded.uri) {
      return NextResponse.json({ error: 'Failed to upload image to Gemini' }, { status: 500 });
    }

    let file = uploaded;
    const maxWait = 60000;
    const start = Date.now();
    while (file.state !== 'ACTIVE' && Date.now() - start < maxWait) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const name = file.name || file.uri?.split('/').pop() || '';
        if (name) file = await ai.files.get({ name });
      } catch {
        // ignore
      }
    }
    if (file.state !== 'ACTIVE' || !file.uri) {
      return NextResponse.json({ error: 'Image file not ready in time' }, { status: 500 });
    }

    const systemPrompt = `You are an expert prompt engineer for AI image editing. The user will provide an image (a static ad or creative) and short instructions describing what they want to change. Your job is to output a single, detailed image-generation prompt that describes the FULL image AFTER applying the requested edits. The prompt will be used with an image-to-image model (Nano Banana 2), so it must:
1. Describe the entire scene, layout, colors, typography, and composition.
2. Incorporate the user's requested changes clearly.
3. Preserve everything in the image that the user did not ask to change.
4. Be in English, concise but specific enough for a model to reproduce the edited ad.

Output ONLY the prompt text, no preamble or explanation.`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri: file.uri, mimeType: file.mimeType || mimeType } },
            { text: `${systemPrompt}\n\nUser instructions for the edit:\n${instructions.trim()}\n\nOutput the full image prompt for the edited ad (only the prompt, no other text):` },
          ],
        },
      ],
    });

    const text = result.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('').trim();
    if (!text) {
      return NextResponse.json({ error: 'No edit prompt generated' }, { status: 500 });
    }
    return NextResponse.json({ prompt: text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate edit prompt';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
