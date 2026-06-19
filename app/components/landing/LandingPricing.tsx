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
    <div className="inline-flex items-center gap-1 rounded border border-outline-variant bg-surface-container-lowest p-1">
      <button
        type="button"
        onClick={() => onChange('monthly')}
        className={cn(
          'rounded px-5 py-2 font-mono text-label-caps uppercase tracking-widest transition-colors',
          billing === 'monthly'
            ? 'bg-primary text-on-primary'
            : 'text-on-surface-variant hover:text-primary'
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange('yearly')}
        className={cn(
          'rounded px-5 py-2 font-mono text-label-caps uppercase tracking-widest transition-colors',
          billing === 'yearly'
            ? 'bg-primary text-on-primary'
            : 'text-on-surface-variant hover:text-primary'
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
        <article className="w-full max-w-lg rounded-xl border border-outline-variant bg-surface-container-low p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-eyebrow uppercase tracking-widest text-on-surface-variant">
                {ONE_TIME_PACK.name}
              </p>
              <p className="mt-1 text-body-md text-on-surface-variant">{ONE_TIME_PACK.tagline}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-headline-md font-extrabold text-primary">${ONE_TIME_PACK.priceUsd}</p>
              <p className="text-body-md text-on-surface-variant">one-time</p>
            </div>
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-body-md text-on-surface-variant">
            {oneTimePlanFeatureList().slice(0, 4).map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <MaterialIcon name="check" className="text-sm text-outline" />
                {f}
              </li>
            ))}
          </ul>
          <a
            href={`/login?next=checkout&plan=${ONE_TIME_PACK.checkoutKey}`}
            className="mt-5 inline-flex w-full items-center justify-center rounded bg-primary px-6 py-3 font-mono text-label-caps uppercase tracking-wider text-on-primary transition-colors hover:bg-surface-tint sm:w-auto"
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
                'relative flex h-full flex-col rounded-xl p-8',
                isFeatured
                  ? 'border-2 border-primary bg-surface'
                  : 'border border-outline-variant bg-surface'
              )}
            >
              {isFeatured && (
                <div className="absolute right-0 top-0 -translate-y-2 translate-x-2">
                  <span className="rounded-full border border-primary bg-accent-gold px-3 py-1 font-mono text-eyebrow uppercase tracking-widest text-primary">
                    Recommended
                  </span>
                </div>
              )}
              <div className="mb-8">
                <h3
                  className={cn(
                    'mb-2 font-mono text-eyebrow uppercase tracking-widest',
                    isFeatured ? 'text-primary' : 'text-on-surface-variant'
                  )}
                >
                  {plan.name}
                </h3>
                <div className="text-headline-lg font-extrabold text-primary">
                  ${price.amount}
                  <span className="text-body-md font-normal text-on-surface-variant">{price.suffix}</span>
                </div>
                {price.sublabel && (
                  <p className="mt-1 text-body-md text-on-surface-variant">{price.sublabel}</p>
                )}
                <p className="mt-4 text-body-md text-on-surface-variant">{plan.tagline}</p>
              </div>
              <ul className="mb-8 flex-grow space-y-4">
                {planFeatureList(plan).map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <MaterialIcon
                      name="check"
                      className={cn('mt-1 text-sm', isFeatured ? 'text-primary' : 'text-outline')}
                    />
                    <span className={cn('text-body-md', isFeatured && f.includes('Priority') ? 'font-bold text-primary' : 'text-on-surface')}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
              <a
                href={href}
                className={cn(
                  'w-full rounded py-4 text-center font-mono text-label-caps uppercase tracking-wider transition-colors',
                  isFeatured
                    ? 'bg-primary text-on-primary hover:bg-surface-tint'
                    : 'border border-outline-variant text-primary hover:bg-surface-container-low'
                )}
              >
                Get started
              </a>
            </article>
          );
        })}
      </div>

      <article className="mx-auto mt-8 max-w-5xl rounded-xl border border-outline-variant bg-surface p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-mono text-eyebrow uppercase tracking-widest text-on-surface-variant">
              {AGENCY_PLAN_DISPLAY.name}
            </h3>
            <p className="mt-2 text-headline-md font-extrabold text-primary">Custom</p>
            <p className="mt-2 text-body-md text-on-surface-variant">{AGENCY_PLAN_DISPLAY.tagline}</p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {AGENCY_PLAN_DISPLAY.features.slice(0, 4).map((f) => (
              <li key={f} className="flex items-center gap-2 text-body-md text-on-surface-variant">
                <MaterialIcon name="check" className="text-sm text-outline" />
                {f}
              </li>
            ))}
          </ul>
          <a
            href="mailto:support@admirror.io"
            className="shrink-0 rounded border border-outline-variant px-6 py-4 text-center font-mono text-label-caps uppercase tracking-wider text-primary transition-colors hover:bg-surface-container-low"
          >
            Contact sales
          </a>
        </div>
      </article>

      <p className="mt-8 text-center font-mono text-eyebrow uppercase tracking-widest text-on-surface-variant opacity-80">
        1 credit = 1 image · Subscriptions cancel anytime
      </p>
    </>
  );
}
