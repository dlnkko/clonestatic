'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Reveal } from './Reveal';
import {
  FREE_PLAN_FEATURES,
  FREE_TRIAL_CREDITS,
  PAID_PLANS,
  planDisplayPrice,
  planFeatureList,
  type BillingPeriod,
} from '@/lib/plans';

function Check() {
  return (
    <svg className="h-5 w-5 shrink-0 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function BillingToggle({
  billing,
  onChange,
}: {
  billing: BillingPeriod;
  onChange: (b: BillingPeriod) => void;
}) {
  return (
    <div className="landing-pricing-toggle inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white p-1 shadow-lg shadow-slate-200/40">
      <button
        type="button"
        onClick={() => onChange('monthly')}
        className={cn(
          'rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-300',
          billing === 'monthly' ? 'landing-pricing-toggle-active text-white' : 'text-slate-600 hover:text-slate-900'
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange('yearly')}
        className={cn(
          'flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300',
          billing === 'yearly' ? 'landing-pricing-toggle-active text-white' : 'text-slate-600 hover:text-slate-900'
        )}
      >
        Annual
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            billing === 'yearly' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
          )}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10v10M7 17L17 7" />
          </svg>
          20% off
        </span>
      </button>
    </div>
  );
}

export function LandingPricing() {
  const [billing, setBilling] = useState<BillingPeriod>('monthly');

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal direction="down" className="text-center">
        <p className="landing-section-label landing-section-label-dark mx-auto">Pricing</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
          Start free. Scale when you&apos;re winning.
        </h2>
      </Reveal>

      <Reveal direction="up" delayMs={80} className="mt-10 flex justify-center">
        <BillingToggle billing={billing} onChange={setBilling} />
      </Reveal>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Reveal direction="up" delayMs={0}>
          <article className="landing-pricing-card flex h-full flex-col rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm transition-shadow hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Free trial</p>
            <h3 className="mt-2 text-xl font-bold text-slate-900">Try it free</h3>
            <p className="mt-8 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-slate-900">$0</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">{FREE_TRIAL_CREDITS} generations, no card</p>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-600">
              {FREE_PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <a
              href="/login?next=/app"
              className="mt-8 inline-flex w-full items-center justify-center rounded-xl border-2 border-slate-900 py-3.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
            >
              Get started
            </a>
          </article>
        </Reveal>

        {PAID_PLANS.map((plan, i) => {
          const isFeatured = plan.badge === 'popular';
          const price = planDisplayPrice(plan, billing);
          const href = `/login?next=checkout&plan=${billing === 'yearly' ? plan.checkoutYearly : plan.checkoutMonthly}`;

          return (
            <Reveal key={plan.key} direction="up" delayMs={(i + 1) * 70}>
              <article
                className={cn(
                  'relative flex h-full flex-col rounded-3xl p-7 transition-all',
                  isFeatured
                    ? 'landing-pricing-card-featured border-2 border-indigo-400/60 bg-gradient-to-b from-indigo-50/80 to-white shadow-lg shadow-indigo-100/50'
                    : 'landing-pricing-card border border-slate-200/80 bg-white shadow-sm hover:shadow-md'
                )}
              >
                {isFeatured && (
                  <span className="absolute right-5 top-5 rounded-full bg-[var(--brand-gradient)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Most popular
                  </span>
                )}
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{plan.name}</p>
                <p className="mt-2 min-h-[2.5rem] text-sm leading-snug text-slate-500">{plan.tagline}</p>
                <p className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-slate-900">${price.amount}</span>
                  <span className="text-slate-500">{price.suffix}</span>
                </p>
                {price.sublabel && (
                  <p className="mt-1 text-sm font-medium text-emerald-600">{price.sublabel}</p>
                )}
                <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-600">
                  {planFeatureList(plan).map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={href}
                  className={cn(
                    'mt-8 inline-flex w-full items-center justify-center rounded-xl py-3.5 text-sm font-semibold transition-all',
                    isFeatured
                      ? 'landing-btn-primary shadow-md'
                      : 'border-2 border-slate-900 text-slate-900 hover:bg-slate-50'
                  )}
                >
                  Subscribe
                </a>
              </article>
            </Reveal>
          );
        })}
      </div>

      <Reveal direction="up" delayMs={100} className="mt-6 text-center">
        <p className="text-xs text-slate-400">1 credit = 1 image · Cancel anytime</p>
      </Reveal>
    </div>
  );
}
