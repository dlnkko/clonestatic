import { GoogleGenAI } from '@google/genai';
import { GEMINI_MODEL } from '@/lib/gemini-model';
import { usageFromMetadata } from './cost';
import type { Step2Usage } from './types';

export function getGoogleGenAI() {
  const googleApiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!googleApiKey) {
    throw new Error('GOOGLE_GENAI_API_KEY is not set');
  }
  return new GoogleGenAI({ apiKey: googleApiKey });
}

export function extractText(response: {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}): string {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) return '';
  return parts.map((p) => p.text || '').join('').trim();
}

export function extractUsage(response: unknown): Step2Usage | null {
  return usageFromMetadata((response as { usageMetadata?: Step2Usage })?.usageMetadata);
}

export async function generateText(
  ai: GoogleGenAI,
  userText: string,
  options?: { json?: boolean }
): Promise<{ text: string; usage: Step2Usage | null }> {
  const result = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    ...(options?.json
      ? { config: { responseMimeType: 'application/json' } }
      : {}),
  });
  return { text: extractText(result), usage: extractUsage(result) };
}

export async function generateWithProductImage(
  ai: GoogleGenAI,
  productFile: { uri: string; mimeType?: string },
  userText: string,
  options?: { json?: boolean }
): Promise<{ text: string; usage: Step2Usage | null }> {
  return generateWithProductImages(ai, [productFile], userText, options);
}

export async function generateWithProductImages(
  ai: GoogleGenAI,
  productFiles: { uri: string; mimeType?: string }[],
  userText: string,
  options?: { json?: boolean }
): Promise<{ text: string; usage: Step2Usage | null }> {
  const imageParts = productFiles.map((f) => ({
    fileData: {
      fileUri: f.uri,
      mimeType: f.mimeType || 'image/png',
    },
  }));
  const result = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [...imageParts, { text: userText }],
      },
    ],
    ...(options?.json
      ? { config: { responseMimeType: 'application/json' } }
      : {}),
  });
  return { text: extractText(result), usage: extractUsage(result) };
}

export function parseJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(jsonStr) as T;
}
