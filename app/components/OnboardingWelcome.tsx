'use client';

import { Space_Grotesk } from 'next/font/google';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { DISCOVERY_SOURCES, type DiscoverySourceId } from '@/lib/discovery-sources';
import { AdmirrorLogo } from '@/app/components/AdmirrorLogo';

const onboardingFont = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
});

type Step = 'thanks' | 'discovery' | 'product';

type Props = {
  hasProducts?: boolean;
  onUpload: () => void;
  onSkip: () => void;
};

const STEPS: Step[] = ['thanks', 'discovery', 'product'];

export function OnboardingWelcome({ hasProducts = false, onUpload, onSkip }: Props) {
  const [step, setStep] = useState<Step>('thanks');
  const [savingDiscovery, setSavingDiscovery] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DiscoverySourceId | null>(null);

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const afterDiscovery = () => {
    if (hasProducts) {
      onSkip();
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
      className={cn(
        onboardingFont.className,
        'landing-root landing-minimal relative flex min-h-screen flex-col overflow-hidden text-[var(--landing-fg)]'
      )}
    >
      <div className="landing-cnvs-bg" aria-hidden>
        <div className="landing-cnvs-glow" />
        <div className="landing-cnvs-stars" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-center px-4 pt-8 sm:pt-10">
        <AdmirrorLogo theme="light" size="md" />
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-12">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.2em] text-white/35">
              <span>
                {stepIndex + 1} / {STEPS.length}
              </span>
              <span>
                {step === 'thanks' ? 'Welcome' : step === 'discovery' ? 'Source' : 'Product'}
              </span>
            </div>
            <div className="mt-3 h-px overflow-hidden bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-indigo-400 transition-[width] duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div key={step} className="onboarding-step">
            {step === 'thanks' && (
              <div className="text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                  You&apos;re in
                </p>
                <h1 className="mt-5 text-[2rem] font-semibold tracking-tight text-white sm:text-[2.35rem] sm:leading-[1.15]">
                  Thanks for purchasing admirror
                </h1>
                <p className="mx-auto mt-5 max-w-sm text-[15px] leading-relaxed text-white/50">
                  Scaling your brand with static ads just got easier. A couple of quick steps and
                  you&apos;re ready to clone.
                </p>
                <button
                  type="button"
                  onClick={() => setStep('discovery')}
                  className="landing-btn-hero mx-auto mt-10 inline-flex w-full max-w-xs items-center justify-center gap-2"
                >
                  Continue
                  <svg
                    className="landing-btn-hero-arrow h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
            )}

            {step === 'discovery' && (
              <div className="text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
                  Quick question
                </p>
                <h1 className="mt-5 text-[2rem] font-semibold tracking-tight text-white sm:text-[2.35rem] sm:leading-[1.15]">
                  How did you find us?
                </h1>
                <p className="mx-auto mt-5 max-w-sm text-[15px] leading-relaxed text-white/50">
                  Optional — helps us know where to show up.
                </p>
                <div className="mt-8 grid grid-cols-2 gap-2.5">
                  {DISCOVERY_SOURCES.map((source, i) => (
                    <button
                      key={source.id}
                      type="button"
                      disabled={savingDiscovery}
                      onClick={() => void saveDiscovery(source.id)}
                      className={cn(
                        'onboarding-chip rounded-xl border px-3 py-3.5 text-sm font-medium disabled:opacity-50',
                        selectedSource === source.id
                          ? 'border-cyan-400/45 bg-cyan-400/10 text-white'
                          : 'border-white/[0.08] bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06] hover:text-white'
                      )}
                      style={{ animationDelay: `${80 + i * 45}ms` }}
                    >
                      {source.label}
                    </button>
                  ))}
                </div>
                {savingDiscovery && (
                  <p className="mt-5 text-xs tracking-wide text-white/35">Saving…</p>
                )}
              </div>
            )}

            {step === 'product' && (
              <div className="text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
                  Optional
                </p>
                <h1 className="mt-5 text-[2rem] font-semibold tracking-tight text-white sm:text-[2.35rem] sm:leading-[1.15]">
                  Add a product to start
                </h1>
                <p className="mx-auto mt-5 max-w-sm text-[15px] leading-relaxed text-white/50">
                  Paste a product page URL and we&apos;ll pull packaging, copy, and branding. You can
                  skip and do this later.
                </p>
                <button
                  type="button"
                  onClick={onUpload}
                  className="landing-btn-hero mx-auto mt-10 inline-flex w-full max-w-xs items-center justify-center gap-2"
                >
                  Add your first product
                  <svg
                    className="landing-btn-hero-arrow h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={onSkip}
                  className="mt-6 text-sm text-white/35 transition-colors duration-200 hover:text-white/70"
                >
                  Skip for now
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
