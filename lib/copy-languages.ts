export type CopyLanguageOption = {
  code: string;
  label: string;
  /** Full name for prompts */
  name: string;
};

/** 15 most widely used languages for ad copy. */
export const COPY_LANGUAGES: CopyLanguageOption[] = [
  { code: 'en', label: 'English', name: 'English' },
  { code: 'es', label: 'Español', name: 'Spanish' },
  { code: 'zh', label: '中文 (简体)', name: 'Chinese (Simplified)' },
  { code: 'hi', label: 'हिन्दी', name: 'Hindi' },
  { code: 'ar', label: 'العربية', name: 'Arabic' },
  { code: 'pt', label: 'Português', name: 'Portuguese' },
  { code: 'fr', label: 'Français', name: 'French' },
  { code: 'de', label: 'Deutsch', name: 'German' },
  { code: 'ja', label: '日本語', name: 'Japanese' },
  { code: 'ko', label: '한국어', name: 'Korean' },
  { code: 'it', label: 'Italiano', name: 'Italian' },
  { code: 'ru', label: 'Русский', name: 'Russian' },
  { code: 'tr', label: 'Türkçe', name: 'Turkish' },
  { code: 'id', label: 'Bahasa Indonesia', name: 'Indonesian' },
  { code: 'vi', label: 'Tiếng Việt', name: 'Vietnamese' },
];

const DEFAULT = COPY_LANGUAGES[0];

export function resolveCopyLanguage(code: unknown): CopyLanguageOption {
  if (typeof code !== 'string' || !code.trim()) return DEFAULT;
  const normalized = code.trim().toLowerCase();
  return COPY_LANGUAGES.find((l) => l.code === normalized) ?? DEFAULT;
}

export function copyLanguageInstruction(lang: CopyLanguageOption): string {
  return `**COPY LANGUAGE (CRITICAL):** All ad copy in the final image (tagline, headline, main line, slogan, CTA text, review quote, promo badges with words) MUST be written in **${lang.name}** (${lang.code}). Natural, grammatically correct, conversion-ready copy for native speakers. Do NOT use English unless ${lang.name} is English.`;
}
