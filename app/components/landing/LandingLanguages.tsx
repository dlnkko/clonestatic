'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { COPY_LANGUAGES } from '@/lib/copy-languages';
import { Reveal } from './Reveal';

const AD_SAMPLES = [
  { code: 'en', label: 'English', headline: 'Your skin, upgraded.', cta: 'Shop now' },
  { code: 'de', label: 'Deutsch', headline: 'Deine Haut, neu definiert.', cta: 'Jetzt kaufen' },
  { code: 'fr', label: 'Français', headline: 'Votre peau, sublimée.', cta: 'Acheter' },
  { code: 'sv', label: 'Svenska', headline: 'Din hud, uppgraderad.', cta: 'Handla nu' },
  { code: 'es', label: 'Español', headline: 'Tu piel, elevada.', cta: 'Comprar ya' },
  { code: 'it', label: 'Italiano', headline: 'La tua pelle, rinnovata.', cta: 'Acquista' },
  { code: 'ja', label: '日本語', headline: '肌を、次のレベルへ。', cta: '今すぐ購入' },
  { code: 'nl', label: 'Nederlands', headline: 'Jouw huid, geüpgraded.', cta: 'Nu shoppen' },
  { code: 'pt', label: 'Português', headline: 'Sua pele, elevada.', cta: 'Comprar' },
  { code: 'pl', label: 'Polski', headline: 'Twoja skóra, ulepszona.', cta: 'Kup teraz' },
] as const;

const MARQUEE_A = COPY_LANGUAGES.filter((l) =>
  ['en', 'de', 'fr', 'sv', 'es', 'it', 'nl', 'pl', 'da', 'no', 'fi', 'pt'].includes(l.code)
);
const MARQUEE_B = COPY_LANGUAGES.filter((l) =>
  ['ja', 'ko', 'zh', 'hi', 'ru', 'uk', 'tr', 'ar', 'he', 'fa', 'id', 'vi', 'th'].includes(l.code)
);

function LanguageChip({ label, code }: { label: string; code: string }) {
  return (
    <span className="landing-lang-chip">
      <span className="landing-lang-chip-code">{code.toUpperCase()}</span>
      {label}
    </span>
  );
}

function LanguageMarqueeRow({
  items,
  reverse,
  className,
}: {
  items: typeof COPY_LANGUAGES;
  reverse?: boolean;
  className?: string;
}) {
  const track = [...items, ...items];
  return (
    <div className={cn('landing-lang-marquee-row', className)} aria-hidden>
      <div className={cn('landing-lang-marquee-track', reverse && 'landing-lang-marquee-track-reverse')}>
        {track.map((lang, i) => (
          <LanguageChip key={`${lang.code}-${i}`} label={lang.label} code={lang.code} />
        ))}
      </div>
    </div>
  );
}

export function LandingLanguages() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const sample = AD_SAMPLES[index];

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % AD_SAMPLES.length);
        setVisible(true);
      }, 320);
    }, 3200);

    return () => window.clearInterval(id);
  }, []);

  return (
    <section id="languages" className="relative px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/70">
              {COPY_LANGUAGES.length}+ languages
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--landing-fg)] sm:text-3xl">
              Static ads in the language your market speaks
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/50">
              Pick a copy language before you generate — headlines, CTAs, promos, and badges are
              written natively, not translated word-for-word.
            </p>
          </div>
        </Reveal>

        <Reveal delayMs={120} className="mt-10">
          <div className="landing-lang-card overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <div className="grid gap-0 md:grid-cols-[1fr,1.1fr]">
              <div className="relative flex min-h-[220px] flex-col justify-center border-b border-white/[0.06] p-6 sm:p-8 md:border-b-0 md:border-r">
                <div className="landing-lang-ad-mock mx-auto w-full max-w-[240px]">
                  <div className="mb-3 flex items-center justify-between text-[9px] font-medium uppercase tracking-wider text-white/30">
                    <span>Ad preview</span>
                    <span
                      className={cn(
                        'rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-cyan-300/90 transition-opacity duration-300',
                        visible ? 'opacity-100' : 'opacity-40'
                      )}
                    >
                      {sample.label}
                    </span>
                  </div>
                  <div className="landing-lang-ad-frame rounded-xl border border-white/[0.08] bg-[#0a0f1c]/80 p-4">
                    <div className="mb-3 h-16 rounded-lg bg-gradient-to-br from-white/[0.06] to-white/[0.02]" />
                    <p
                      className={cn(
                        'landing-lang-headline min-h-[2.75rem] text-[15px] font-semibold leading-snug text-white transition-all duration-300',
                        visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
                      )}
                      dir={['ar', 'he', 'fa'].includes(sample.code) ? 'rtl' : 'ltr'}
                    >
                      {sample.headline}
                    </p>
                    <span
                      className={cn(
                        'landing-lang-cta mt-3 inline-block text-[11px] font-semibold text-cyan-300/90 transition-all duration-300 delay-75',
                        visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
                      )}
                    >
                      {sample.cta} →
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-center gap-5 p-6 sm:p-8">
                <ul className="space-y-3 text-sm text-white/55">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-400/80" />
                    German, French, Swedish, Dutch, and every major EU market
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-400/80" />
                    Japanese, Korean, Arabic, Hebrew — RTL layouts supported
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-400/80" />
                    Same winning layout — copy adapts to each locale
                  </li>
                </ul>
                <p className="text-xs text-white/35">
                  Set once in the dashboard before you clone. No extra prompts.
                </p>
              </div>
            </div>

            <div className="border-t border-white/[0.06] py-4">
              <LanguageMarqueeRow items={MARQUEE_A} />
              <LanguageMarqueeRow items={MARQUEE_B} reverse className="mt-2.5" />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
