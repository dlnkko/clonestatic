'use client';

import { cn } from '@/lib/cn';
import { AGENCY_PLAN_DISPLAY, ONE_TIME_PACK, PAID_PLANS, oneTimePlanFeatureList, planDisplayPrice, planFeatureList, type BillingPeriod } from '@/lib/plans';

type Props = {
  open: boolean;
  onClose: () => void;
  billing: BillingPeriod;
  onBillingChange: (b: BillingPeriod) => void;
};

export function PricingModal({ open, onClose, billing, onBillingChange }: Props) {
  if (!open) return null;

  const founderUrl = process.env.NEXT_PUBLIC_TELEGRAM_FOUNDER ?? 'https://t.me/yourusername';

  return (
    <div className="dash-modal-root" role="dialog" aria-modal="true" aria-labelledby="pricing-title">
      <button type="button" className="dash-modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="dash-modal dash-modal-wide dash-animate-scale">
        <div className="dash-modal-header">
          <div>
            <h2 id="pricing-title" className="text-lg font-semibold tracking-tight text-[var(--dash-fg)]">
              Choose a plan
            </h2>
          </div>
          <button type="button" onClick={onClose} className="dash-icon-btn" aria-label="Close">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="dash-modal-body">
          <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 to-white p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-[var(--dash-fg)]">{ONE_TIME_PACK.name}</h3>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                    One-time
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--dash-muted)]">{ONE_TIME_PACK.tagline}</p>
                <p className="mt-3 flex items-baseline gap-1 text-[var(--dash-fg)]">
                  <span className="text-2xl font-bold">${ONE_TIME_PACK.priceUsd}</span>
                  <span className="text-sm text-[var(--dash-muted)]">once</span>
                </p>
                <ul className="mt-3 grid gap-1.5 text-xs text-[var(--dash-muted)] sm:grid-cols-2">
                  {oneTimePlanFeatureList().slice(0, 4).map((f) => (
                    <li key={f} className="dash-check-item">{f}</li>
                  ))}
                </ul>
              </div>
              <a
                href={`/checkout-redirect?plan=${ONE_TIME_PACK.checkoutKey}`}
                className="dash-btn shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Buy 10 ads
              </a>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
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
                className={cn(
                  'dash-segmented-item inline-flex items-center gap-1.5',
                  billing === 'yearly' && 'dash-segmented-item-active'
                )}
              >
                Annual
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-600">
                  20% off
                </span>
              </button>
            </div>
            <p className="text-xs text-[var(--dash-muted)]">Whop checkout · same Google email</p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PAID_PLANS.map((plan) => {
              const featured = plan.badge === 'popular';
              const price = planDisplayPrice(plan, billing);
              const checkoutKey = billing === 'yearly' ? plan.checkoutYearly : plan.checkoutMonthly;

              return (
                <div
                  key={plan.key}
                  className={cn('dash-pricing-card relative', featured && 'dash-pricing-card-featured')}
                >
                  {featured && (
                    <span className="absolute right-4 top-4 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Popular
                    </span>
                  )}
                  <h3 className={cn('font-semibold', featured ? 'text-white' : 'text-[var(--dash-fg)]')}>
                    {plan.name}
                  </h3>
                  <p className={cn('mt-1 text-xs', featured ? 'text-white/70' : 'text-[var(--dash-muted)]')}>
                    {plan.tagline}
                  </p>
                  <p className={cn('mt-4 flex items-baseline gap-1', featured ? 'text-white' : 'text-[var(--dash-fg)]')}>
                    <span className="text-2xl font-bold">${price.amount}</span>
                    <span className={cn('text-sm', featured ? 'text-white/70' : 'text-[var(--dash-muted)]')}>
                      {price.suffix}
                    </span>
                  </p>
                  {price.sublabel && (
                    <p className={cn('mt-0.5 text-xs font-medium', featured ? 'text-emerald-200' : 'text-emerald-600')}>
                      {price.sublabel}
                    </p>
                  )}
                  <ul className={cn('mt-4 space-y-2 text-sm', featured ? 'text-white/75' : 'text-[var(--dash-muted)]')}>
                    {planFeatureList(plan).map((f) => (
                      <li key={f} className={cn('dash-check-item', featured && 'dash-check-item-light')}>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`/checkout-redirect?plan=${checkoutKey}`}
                    className={cn(
                      'dash-btn mt-5 w-full',
                      featured ? 'bg-white text-zinc-900 hover:bg-zinc-100' : 'dash-btn-secondary'
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
