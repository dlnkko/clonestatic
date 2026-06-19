'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { MaterialIcon } from './MaterialIcon';
import {
  AGENCY_PLAN_DISPLAY,
  ONE_TIME_PACK,
  PAID_PLANS,
  oneTimePlanFeatureList,
  planDisplayPrice,
  planFeatureList,
  type BillingPeriod,
} from '@/lib/plans';

function BillingToggle({
  billing,
  onChange,
}: {
  billing: BillingPeriod;
  onChange: (b: BillingPeriod) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-outline-variant/30 bg-surface-container-lowest p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange('monthly')}
        className={cn(
          'rounded-full px-6 py-2.5 font-mono text-label-caps uppercase tracking-widest transition-all duration-300',
          billing === 'monthly'
            ? 'bg-primary text-on-primary shadow-md'
            : 'text-on-surface-variant hover:text-primary hover:bg-surface-variant/50'
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange('yearly')}
        className={cn(
          'rounded-full px-6 py-2.5 font-mono text-label-caps uppercase tracking-widest transition-all duration-300',
          billing === 'yearly'
            ? 'bg-primary text-on-primary shadow-md'
            : 'text-on-surface-variant hover:text-primary hover:bg-surface-variant/50'
        )}
      >
        Annual · 20% off
      </button>
    </div>
  );
}

export function LandingPricing() {
  const [billing, setBilling] = useState<BillingPeriod>('monthly');

  return (
    <>
      <div className="mb-10 flex justify-center">
        <article className="w-full max-w-lg rounded-2xl border border-outline-variant/50 bg-white/60 p-8 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-md hover:border-primary/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-eyebrow uppercase tracking-widest text-primary">
                {ONE_TIME_PACK.name}
              </p>
              <p className="mt-2 text-body-md text-on-surface-variant font-medium">{ONE_TIME_PACK.tagline}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-headline-md font-black text-primary">${ONE_TIME_PACK.priceUsd}</p>
              <p className="text-body-md text-on-surface-variant font-mono text-[10px] uppercase tracking-widest">one-time</p>
            </div>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-body-md text-on-surface-variant">
            {oneTimePlanFeatureList().slice(0, 4).map((f) => (
              <li key={f} className="flex items-center gap-2">
                <MaterialIcon name="check_circle" className="text-sm text-[#C8B89A]" />
                {f}
              </li>
            ))}
          </ul>
          <a
            href={`/login?next=checkout&plan=${ONE_TIME_PACK.checkoutKey}`}
            className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-primary px-8 py-4 font-mono text-label-caps uppercase tracking-wider text-on-primary transition-all duration-300 hover:bg-surface-tint hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] sm:w-auto"
          >
            Buy 10 ads
          </a>
        </article>
      </div>

      <div className="mb-12 flex justify-center">
        <BillingToggle billing={billing} onChange={setBilling} />
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
        {PAID_PLANS.map((plan) => {
          const isFeatured = plan.badge === 'popular';
          const price = planDisplayPrice(plan, billing);
          const href = `/login?next=checkout&plan=${billing === 'yearly' ? plan.checkoutYearly : plan.checkoutMonthly}`;

          return (
            <article
              key={plan.key}
              className={cn(
                'relative flex h-full flex-col rounded-3xl p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl',
                isFeatured
                  ? 'border-2 border-primary bg-white shadow-lg scale-105 z-10'
                  : 'border border-outline-variant/50 bg-white/60 backdrop-blur-sm'
              )}
            >
              {isFeatured && (
                <div className="absolute right-0 top-0 -translate-y-1/2 translate-x-4">
                  <span className="rounded-full border border-primary bg-primary px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-md">
                    Recommended
                  </span>
                </div>
              )}
              <div className="mb-8">
                <h3
                  className={cn(
                    'mb-4 font-mono text-eyebrow uppercase tracking-widest',
                    isFeatured ? 'text-primary' : 'text-on-surface-variant'
                  )}
                >
                  {plan.name}
                </h3>
                <div className="text-[3rem] font-black leading-none tracking-tighter text-primary">
                  ${price.amount}
                  <span className="ml-1 text-body-md font-normal text-on-surface-variant">{price.suffix}</span>
                </div>
                {price.sublabel && (
                  <p className="mt-2 text-body-sm font-medium text-primary/60">{price.sublabel}</p>
                )}
                <p className="mt-6 text-body-md text-on-surface-variant leading-relaxed">{plan.tagline}</p>
              </div>
              <ul className="mb-10 flex-grow space-y-4">
                {planFeatureList(plan).map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <MaterialIcon
                      name="check_circle"
                      className={cn('mt-0.5 text-base', isFeatured ? 'text-[#C8B89A]' : 'text-outline-variant')}
                    />
                    <span className={cn('text-body-md leading-tight', isFeatured && f.includes('Priority') ? 'font-bold text-primary' : 'text-on-surface')}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
              <a
                href={href}
                className={cn(
                  'w-full rounded-full py-4 text-center font-mono text-label-caps uppercase tracking-wider transition-all duration-300 active:scale-[0.98]',
                  isFeatured
                    ? 'bg-primary text-on-primary shadow-md hover:bg-surface-tint hover:shadow-lg'
                    : 'border border-outline-variant text-primary hover:bg-surface-container-low hover:border-primary/30'
                )}
              >
                Get started
              </a>
            </article>
          );
        })}
      </div>

      <article className="mx-auto mt-16 max-w-5xl rounded-3xl border border-outline-variant/30 bg-gradient-to-br from-white/80 to-white/40 p-10 shadow-lg backdrop-blur-xl">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="md:w-1/3">
            <h3 className="font-mono text-eyebrow uppercase tracking-widest text-primary/60">
              {AGENCY_PLAN_DISPLAY.name}
            </h3>
            <p className="mt-3 text-4xl font-black tracking-tighter text-primary">Custom</p>
            <p className="mt-4 text-body-md text-on-surface-variant leading-relaxed">{AGENCY_PLAN_DISPLAY.tagline}</p>
          </div>
          <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2 md:w-1/2">
            {AGENCY_PLAN_DISPLAY.features.slice(0, 4).map((f) => (
              <li key={f} className="flex items-center gap-3 text-body-md text-on-surface-variant">
                <MaterialIcon name="check_circle" className="text-base text-[#C8B89A]" />
                {f}
              </li>
            ))}
          </ul>
          <a
            href="mailto:support@admirror.io"
            className="shrink-0 rounded-full border-2 border-primary px-8 py-4 text-center font-mono text-label-caps font-bold uppercase tracking-wider text-primary transition-all duration-300 hover:bg-primary hover:text-white active:scale-[0.98]"
          >
            Contact sales
          </a>
        </div>
      </article>

      <p className="mt-12 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface-variant opacity-60">
        1 credit = 1 image · Subscriptions cancel anytime
      </p>
    </>
  );
}
