'use client';

import { cn } from '@/lib/cn';
import { AGENCY_PLAN_DISPLAY, PAID_PLANS, planFeatureList } from '@/lib/plans';

type Props = {
  open: boolean;
  onClose: () => void;
  billing: 'monthly' | 'yearly';
  onBillingChange: (b: 'monthly' | 'yearly') => void;
};

export function PricingModal({ open, onClose, billing, onBillingChange }: Props) {
  if (!open) return null;

  const founderUrl = process.env.NEXT_PUBLIC_TELEGRAM_FOUNDER ?? 'https://t.me/yourusername';

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

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PAID_PLANS.map((plan) => {
              const featured = plan.badge === 'popular';
              const checkoutKey = billing === 'yearly' ? plan.checkoutYearly : plan.checkoutMonthly;

              return (
                <div
                  key={plan.key}
                  className={cn(
                    'dash-pricing-card relative',
                    featured && 'dash-pricing-card-featured'
                  )}
                >
                  {plan.badge === 'popular' && (
                    <span className="absolute right-4 top-4 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Popular
                    </span>
                  )}
                  {plan.badge === 'best_value' && (
                    <span className="absolute right-4 top-4 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Best value
                    </span>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={cn('font-semibold', featured ? 'text-white' : 'text-[var(--dash-fg)]')}>
                      {plan.name}
                    </h3>
                    <span className={cn('dash-pill shrink-0', featured && 'dash-pill-dark')}>
                      ${plan.monthlyPriceUsd}/mo
                    </span>
                  </div>
                  <p className={cn('mt-1 text-xs', featured ? 'text-white/70' : 'text-[var(--dash-muted)]')}>
                    {plan.tagline}
                  </p>
                  <ul className={cn('mt-4 space-y-2 text-sm', featured ? 'text-white/75' : 'text-[var(--dash-muted)]')}>
                    {planFeatureList(plan).map((f) => (
                      <li
                        key={f}
                        className={cn('dash-check-item', featured && 'dash-check-item-light')}
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`/checkout-redirect?plan=${checkoutKey}`}
                    className={cn(
                      'dash-btn mt-6 w-full',
                      featured
                        ? 'bg-white text-zinc-900 hover:bg-zinc-100'
                        : 'dash-btn-secondary'
                    )}
                  >
                    Continue
                  </a>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-[var(--dash-border)] bg-slate-50/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[var(--dash-fg)]">{AGENCY_PLAN_DISPLAY.name}</h3>
                <p className="mt-0.5 text-xs text-[var(--dash-muted)]">{AGENCY_PLAN_DISPLAY.tagline}</p>
                <p className="mt-2 text-sm text-[var(--dash-muted)]">
                  {AGENCY_PLAN_DISPLAY.features.join(' · ')}
                </p>
              </div>
              <a
                href={founderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="dash-btn dash-btn-secondary shrink-0 text-sm"
              >
                Contact sales
              </a>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-[var(--dash-muted)]">
            Each generate uses 1 credit. Cancel anytime from the sidebar.
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
