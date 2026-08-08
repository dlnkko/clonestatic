'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  AGENCY_PLAN_DISPLAY,
  CREDIT_PACK_OPTIONS,
  PAID_PLANS,
  isPaidPlan,
  planDisplayName,
  planDisplayPrice,
  planFeatureList,
  type BillingPeriod,
} from '@/lib/plans';

type Props = {
  open: boolean;
  onClose: () => void;
  billing: BillingPeriod;
  onBillingChange: (b: BillingPeriod) => void;
  /** Active subscription plan key from /api/subscription (e.g. standard, free_trial). */
  currentPlan?: string | null;
};

function CreditPackUpgradeSlider() {
  const [index, setIndex] = useState(0);
  const pack = CREDIT_PACK_OPTIONS[index] ?? CREDIT_PACK_OPTIONS[0];
  const buyHref = `/checkout-redirect?plan=${pack.checkoutKey}`;
  const progress = (index / Math.max(CREDIT_PACK_OPTIONS.length - 1, 1)) * 100;
  const pricePerCredit = pack.priceUsd / pack.credits;

  const ticks = useMemo(
    () => CREDIT_PACK_OPTIONS.map((p, i) => ({ i, label: String(p.credits) })),
    []
  );

  return (
    <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 to-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-[var(--dash-fg)]">One-time credits</h3>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
              Credits only
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--dash-muted)]">
            Adds credits to your account. Seats and saved products stay as they are — use a monthly plan
            to raise those limits.
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-2xl font-bold tabular-nums text-[var(--dash-fg)]">
            {pack.credits}
            <span className="ml-1 text-sm font-medium text-[var(--dash-muted)]">credits</span>
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-[var(--dash-muted)]">
            ${pricePerCredit.toFixed(2)} / credit
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label className="sr-only" htmlFor="upgrade-credit-pack-slider">
          Select credits
        </label>
        <input
          id="upgrade-credit-pack-slider"
          type="range"
          min={0}
          max={CREDIT_PACK_OPTIONS.length - 1}
          step={1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="w-full accent-emerald-600"
          style={{
            background: `linear-gradient(90deg, rgb(5 150 105) 0%, rgb(5 150 105) ${progress}%, rgb(226 232 240) ${progress}%, rgb(226 232 240) 100%)`,
            height: 6,
            borderRadius: 999,
            appearance: 'none',
          }}
        />
        <div className="mt-2 flex justify-between gap-0.5 overflow-x-auto px-0.5 text-[9px] tabular-nums text-slate-400 sm:text-[10px]">
          {ticks.map((t) => (
            <button
              key={t.i}
              type="button"
              onClick={() => setIndex(t.i)}
              className={cn(
                'shrink-0 transition-colors hover:text-slate-700',
                t.i === index && 'font-semibold text-emerald-700'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <a
          href={buyHref}
          className="dash-btn inline-flex min-w-[8.5rem] justify-center bg-emerald-600 px-6 py-2.5 text-base font-semibold tabular-nums text-white hover:bg-emerald-700"
        >
          ${pack.priceUsd.toFixed(2)}
        </a>
      </div>
    </div>
  );
}

export function PricingModal({ open, onClose, billing, onBillingChange, currentPlan = null }: Props) {
  if (!open) return null;

  const founderUrl = process.env.NEXT_PUBLIC_TELEGRAM_FOUNDER ?? 'https://t.me/yourusername';
  const currentLabel = currentPlan ? planDisplayName(currentPlan) : null;

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
          <CreditPackUpgradeSlider />

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
            {currentLabel && (
              <p className="text-xs text-[var(--dash-muted)]">
                Current plan:{' '}
                <span className="font-semibold text-[var(--dash-fg)]">{currentLabel}</span>
              </p>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PAID_PLANS.map((plan) => {
              const featured = plan.badge === 'popular';
              const price = planDisplayPrice(plan, billing);
              const checkoutKey = billing === 'yearly' ? plan.checkoutYearly : plan.checkoutMonthly;
              const isCurrent = isPaidPlan(currentPlan) && currentPlan === plan.key;

              return (
                <div
                  key={plan.key}
                  className={cn(
                    'dash-pricing-card relative',
                    featured && 'dash-pricing-card-featured',
                    isCurrent && !featured && 'ring-2 ring-emerald-500/40'
                  )}
                >
                  {isCurrent ? (
                    <span
                      className={cn(
                        'absolute right-4 top-4 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                        featured ? 'bg-white/20 text-white' : 'bg-emerald-500/15 text-emerald-700'
                      )}
                    >
                      Current
                    </span>
                  ) : featured ? (
                    <span className="absolute right-4 top-4 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Popular
                    </span>
                  ) : null}
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
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className={cn(
                        'dash-btn mt-5 w-full cursor-default opacity-80',
                        featured ? 'bg-white/20 text-white' : 'dash-btn-secondary'
                      )}
                    >
                      Current plan
                    </button>
                  ) : (
                    <a
                      href={`/checkout-redirect?plan=${checkoutKey}`}
                      className={cn(
                        'dash-btn mt-5 w-full',
                        featured ? 'bg-white text-zinc-900 hover:bg-zinc-100' : 'dash-btn-secondary'
                      )}
                    >
                      Continue
                    </a>
                  )}
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
