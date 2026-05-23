'use client';

import { cn } from '@/lib/cn';

type Props = {
  open: boolean;
  onClose: () => void;
  billing: 'monthly' | 'yearly';
  onBillingChange: (b: 'monthly' | 'yearly') => void;
};

export function PricingModal({ open, onClose, billing, onBillingChange }: Props) {
  if (!open) return null;

  return (
    <div className="dash-modal-root" role="dialog" aria-modal="true" aria-labelledby="pricing-title">
      <button
        type="button"
        className="dash-modal-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="dash-modal dash-modal-wide dash-animate-scale">
        <div className="dash-modal-header">
          <div>
            <h2 id="pricing-title" className="text-lg font-semibold tracking-tight text-[var(--dash-fg)]">
              Choose a plan
            </h2>
            <p className="mt-1 text-sm text-[var(--dash-muted)]">
              Explore the dashboard for free. Generating images requires credits.
            </p>
          </div>
          <button type="button" onClick={onClose} className="dash-icon-btn" aria-label="Close">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="dash-modal-body">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="dash-segmented">
              <button
                type="button"
                onClick={() => onBillingChange('monthly')}
                className={cn('dash-segmented-item', billing === 'monthly' && 'dash-segmented-item-active')}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => onBillingChange('yearly')}
                className={cn('dash-segmented-item', billing === 'yearly' && 'dash-segmented-item-active')}
              >
                Annually
              </button>
            </div>
            <p className="text-xs text-[var(--dash-muted)]">Secure checkout via Whop · same Google email</p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="dash-pricing-card">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[var(--dash-fg)]">Standard</h3>
                <span className="dash-pill">20 images</span>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--dash-fg)]">
                {billing === 'yearly' ? '$79.99' : '$9.99'}
                <span className="text-base font-normal text-[var(--dash-muted)]">
                  {billing === 'yearly' ? ' / year' : ' / month'}
                </span>
              </p>
              {billing === 'yearly' && (
                <p className="mt-1 text-xs text-[var(--dash-muted)]">Billed annually · ~$6.67/mo</p>
              )}
              <ul className="mt-4 space-y-2 text-sm text-[var(--dash-muted)]">
                <li className="dash-check-item">20 AI images (generate or edit)</li>
                <li className="dash-check-item">Clone ads from references</li>
                <li className="dash-check-item">History & downloads</li>
              </ul>
              <a
                href={`/checkout-redirect?plan=${billing === 'yearly' ? 'standard_yearly' : 'standard_monthly'}`}
                className="dash-btn dash-btn-secondary mt-6 w-full"
              >
                Continue
              </a>
            </div>

            <div className="dash-pricing-card dash-pricing-card-featured">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Pro</h3>
                <span className="dash-pill dash-pill-dark">75 images</span>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-white">
                {billing === 'yearly' ? '$229.99' : '$29.99'}
                <span className="text-base font-normal text-white/70">
                  {billing === 'yearly' ? ' / year' : ' / month'}
                </span>
              </p>
              {billing === 'yearly' && (
                <p className="mt-1 text-xs text-white/60">Billed annually · ~$19.17/mo</p>
              )}
              <ul className="mt-4 space-y-2 text-sm text-white/75">
                <li className="dash-check-item dash-check-item-light">75 AI images (generate or edit)</li>
                <li className="dash-check-item dash-check-item-light">Clone ads from references</li>
                <li className="dash-check-item dash-check-item-light">History & downloads</li>
              </ul>
              <a
                href={`/checkout-redirect?plan=${billing === 'yearly' ? 'pro_yearly' : 'pro_monthly'}`}
                className="dash-btn mt-6 w-full bg-white text-zinc-900 hover:bg-zinc-100"
              >
                Continue
              </a>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-[var(--dash-muted)]">
            Editing an image counts as one generation.
          </p>
        </div>

        <div className="dash-modal-footer">
          <button type="button" onClick={onClose} className="dash-btn dash-btn-ghost text-sm">
            Keep exploring
          </button>
        </div>
      </div>
    </div>
  );
}
