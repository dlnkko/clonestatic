'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import { DISCOVERY_SOURCES, type DiscoverySourceId } from '@/lib/discovery-sources';

type Step = 'thanks' | 'discovery' | 'product';

type Props = {
  open: boolean;
  /** After Whop checkout — thank you → discovery → product (optional). */
  postPurchase?: boolean;
  /** Skip product step when the account already has products. */
  hasProducts?: boolean;
  onUpload: () => void;
  onSkip: () => void;
  onComplete?: () => void;
};

export function OnboardingWelcome({
  open,
  postPurchase = false,
  hasProducts = false,
  onUpload,
  onSkip,
  onComplete,
}: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>(postPurchase ? 'thanks' : 'product');
  const [savingDiscovery, setSavingDiscovery] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DiscoverySourceId | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(postPurchase ? 'thanks' : 'product');
    setSelectedSource(null);
    setSavingDiscovery(false);
  }, [open, postPurchase]);

  if (!open) return null;

  const finish = () => {
    onComplete?.();
    onSkip();
  };

  const afterDiscovery = () => {
    if (hasProducts) {
      finish();
      return;
    }
    setStep('product');
  };

  const saveDiscovery = async (source: DiscoverySourceId) => {
    setSelectedSource(source);
    setSavingDiscovery(true);
    try {
      await fetch('/api/me/discovery', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
    } catch {
      /* non-blocking */
    } finally {
      setSavingDiscovery(false);
      afterDiscovery();
    }
  };

  return (
    <div
      className="dash-modal-root dash-modal-root--center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        className={cn(
          'dash-onboarding-modal',
          step === 'discovery' && 'dash-onboarding-modal--wide'
        )}
      >
        <div className="dash-onboarding-glow" aria-hidden />
        <div className="relative z-10 flex flex-col items-center px-6 py-9 text-center sm:px-10 sm:py-11">
          {step === 'thanks' && (
            <>
              <span className="dash-onboarding-badge">You&apos;re in</span>
              <h2
                id="onboarding-title"
                className="mt-5 text-2xl font-bold tracking-tight text-[var(--dash-fg)] sm:text-3xl"
              >
                Thanks for purchasing admirror
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
                Scaling your brand with static ads just got a lot easier. Let&apos;s get you set up.
              </p>
              <button
                type="button"
                onClick={() => setStep('discovery')}
                className="dash-btn dash-btn-primary mt-8 w-full max-w-sm min-h-[52px] text-base touch-manipulation shadow-sm"
              >
                Continue
              </button>
            </>
          )}

          {step === 'discovery' && (
            <>
              <span className="dash-onboarding-badge">Quick question</span>
              <h2
                id="onboarding-title"
                className="mt-5 text-2xl font-bold tracking-tight text-[var(--dash-fg)] sm:text-3xl"
              >
                How did you find us?
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
                Just curious — helps us know where to show up.
              </p>
              <div className="mt-7 grid w-full max-w-lg grid-cols-2 gap-2.5 sm:grid-cols-3">
                {DISCOVERY_SOURCES.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    disabled={savingDiscovery}
                    onClick={() => void saveDiscovery(source.id)}
                    className={cn(
                      'rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-800 disabled:opacity-60',
                      selectedSource === source.id && 'border-indigo-400 bg-indigo-50 text-indigo-800'
                    )}
                  >
                    {source.label}
                  </button>
                ))}
              </div>
              {savingDiscovery && <p className="mt-4 text-xs text-slate-400">Saving…</p>}
            </>
          )}

          {step === 'product' && (
            <>
              <span className="dash-onboarding-badge max-w-[26rem] leading-snug">
                {t('onboarding', 'optional')}
              </span>
              <h2
                id="onboarding-title"
                className="mt-5 text-2xl font-bold tracking-tight text-[var(--dash-fg)] sm:text-3xl"
              >
                {postPurchase ? 'Add a product to start' : t('onboarding', 'title')}
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
                {postPurchase
                  ? 'Paste a product page URL and we will pull packaging, copy, and branding. You can skip and do this later.'
                  : t('onboarding', 'subtitle')}
              </p>
              <button
                type="button"
                onClick={() => {
                  onComplete?.();
                  onUpload();
                }}
                className="dash-btn dash-btn-primary mt-8 w-full max-w-sm min-h-[52px] text-base touch-manipulation shadow-sm"
              >
                {t('onboarding', 'uploadProduct')}
              </button>
              <button
                type="button"
                onClick={finish}
                className="mt-4 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
              >
                {t('onboarding', 'skip')}
              </button>
              <p className="mt-6 text-xs text-slate-400">{t('onboarding', 'later')}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
