export type CopyLanguageRegion = 'global' | 'europe' | 'asia' | 'middle_east';

export type CopyLanguageOption = {
  code: string;
  /** Native label shown in the UI */
  label: string;
  /** English name for AI prompts */
  name: string;
  /** Secondary line in picker (English / exonym) */
  subtitle: string;
  region: CopyLanguageRegion;
};

export const COPY_LANGUAGE_REGION_LABELS: Record<
  CopyLanguageRegion,
  { en: string; es: string; pt: string }
> = {
  global: { en: 'Global', es: 'Global', pt: 'Global' },
  europe: { en: 'Europe', es: 'Europa', pt: 'Europa' },
  asia: { en: 'Asia & Pacific', es: 'Asia y Pacífico', pt: 'Ásia e Pacífico' },
  middle_east: { en: 'Middle East', es: 'Medio Oriente', pt: 'Oriente Médio' },
};

/** Languages supported for generated ad copy. */
export const COPY_LANGUAGES: CopyLanguageOption[] = [
  { code: 'en', label: 'English', name: 'English', subtitle: 'English', region: 'global' },
  { code: 'es', label: 'Español', name: 'Spanish', subtitle: 'Spanish', region: 'global' },
  { code: 'pt', label: 'Português', name: 'Portuguese', subtitle: 'Portuguese', region: 'global' },
  { code: 'fr', label: 'Français', name: 'French', subtitle: 'French', region: 'global' },
  { code: 'de', label: 'Deutsch', name: 'German', subtitle: 'German', region: 'global' },
  { code: 'it', label: 'Italiano', name: 'Italian', subtitle: 'Italian', region: 'global' },
  { code: 'zh', label: '中文 (简体)', name: 'Chinese (Simplified)', subtitle: 'Chinese', region: 'global' },
  { code: 'ja', label: '日本語', name: 'Japanese', subtitle: 'Japanese', region: 'global' },
  { code: 'ko', label: '한국어', name: 'Korean', subtitle: 'Korean', region: 'global' },
  { code: 'hi', label: 'हिन्दी', name: 'Hindi', subtitle: 'Hindi', region: 'global' },
  { code: 'ru', label: 'Русский', name: 'Russian', subtitle: 'Russian', region: 'global' },

  { code: 'nl', label: 'Nederlands', name: 'Dutch', subtitle: 'Dutch', region: 'europe' },
  { code: 'pl', label: 'Polski', name: 'Polish', subtitle: 'Polish', region: 'europe' },
  { code: 'sv', label: 'Svenska', name: 'Swedish', subtitle: 'Swedish', region: 'europe' },
  { code: 'da', label: 'Dansk', name: 'Danish', subtitle: 'Danish', region: 'europe' },
  { code: 'no', label: 'Norsk', name: 'Norwegian', subtitle: 'Norwegian', region: 'europe' },
  { code: 'fi', label: 'Suomi', name: 'Finnish', subtitle: 'Finnish', region: 'europe' },
  { code: 'uk', label: 'Українська', name: 'Ukrainian', subtitle: 'Ukrainian', region: 'europe' },
  { code: 'tr', label: 'Türkçe', name: 'Turkish', subtitle: 'Turkish', region: 'europe' },

  { code: 'id', label: 'Bahasa Indonesia', name: 'Indonesian', subtitle: 'Indonesian', region: 'asia' },
  { code: 'vi', label: 'Tiếng Việt', name: 'Vietnamese', subtitle: 'Vietnamese', region: 'asia' },
  { code: 'th', label: 'ไทย', name: 'Thai', subtitle: 'Thai', region: 'asia' },

  { code: 'ar', label: 'العربية', name: 'Arabic', subtitle: 'Arabic', region: 'middle_east' },
  { code: 'he', label: 'עברית', name: 'Hebrew', subtitle: 'Hebrew', region: 'middle_east' },
  { code: 'fa', label: 'فارسی', name: 'Persian', subtitle: 'Persian (Farsi)', region: 'middle_east' },
];

const LANGUAGE_BY_CODE = new Map(COPY_LANGUAGES.map((l) => [l.code, l]));

const DEFAULT = COPY_LANGUAGES[0];

const REGION_ORDER: CopyLanguageRegion[] = ['global', 'europe', 'asia', 'middle_east'];

export function getCopyLanguage(code: string | null | undefined): CopyLanguageOption {
  if (typeof code !== 'string' || !code.trim()) return DEFAULT;
  const normalized = code.trim().toLowerCase();
  return LANGUAGE_BY_CODE.get(normalized) ?? DEFAULT;
}

export function resolveCopyLanguage(code: unknown): CopyLanguageOption {
  return getCopyLanguage(typeof code === 'string' ? code : undefined);
}

export function copyLanguageRegions(): CopyLanguageRegion[] {
  return REGION_ORDER;
}

export function copyLanguagesByRegion(region: CopyLanguageRegion): CopyLanguageOption[] {
  return COPY_LANGUAGES.filter((l) => l.region === region);
}

export function copyLanguageInstruction(lang: CopyLanguageOption): string {
  return `**COPY LANGUAGE (CRITICAL):** All ad copy in the final image (tagline, headline, main line, slogan, CTA text, review quote, promo badges with words) MUST be written in **${lang.name}** (${lang.code}). Natural, grammatically correct, conversion-ready copy for native speakers. Do NOT use English unless ${lang.name} is English.`;
}
