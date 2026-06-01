'use client';

import { useI18n } from '@/lib/i18n/LocaleProvider';

type Props = {
  open: boolean;
  onUpload: () => void;
  onSkip: () => void;
};

export function OnboardingWelcome({ open, onUpload, onSkip }: Props) {
  const { t } = useI18n();

  if (!open) return null;

  return (
    <div className="dash-modal-root dash-modal-root--center" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="dash-onboarding-modal">
        <div className="dash-onboarding-glow" aria-hidden />
        <div className="relative z-10 flex flex-col items-center px-6 py-9 text-center sm:px-10 sm:py-11">
          <span className="dash-onboarding-badge max-w-[26rem] leading-snug">{t('onboarding', 'optional')}</span>
          <div className="mt-5 grid place-items-center rounded-2xl border border-slate-200/70 bg-white/60 px-4 py-3 shadow-sm backdrop-blur">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/15 via-indigo-500/10 to-transparent ring-1 ring-indigo-200/50 grid place-items-center">
              <span className="text-indigo-600 font-semibold tracking-tight">A</span>
            </div>
          </div>
          <h2 id="onboarding-title" className="mt-5 text-2xl font-bold tracking-tight text-[var(--dash-fg)] sm:text-3xl">
            {t('onboarding', 'title')}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
            {t('onboarding', 'subtitle')}
          </p>
          <button
            type="button"
            onClick={onUpload}
            className="dash-btn dash-btn-primary mt-8 w-full max-w-sm min-h-[52px] text-base touch-manipulation shadow-sm"
          >
            {t('onboarding', 'uploadProduct')}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="mt-4 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            {t('onboarding', 'skip')}
          </button>
          <p className="mt-6 text-xs text-slate-400">{t('onboarding', 'later')}</p>
        </div>
      </div>
    </div>
  );
}
