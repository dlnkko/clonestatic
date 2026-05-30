'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Reveal } from './Reveal';
import {
  FREE_PLAN_FEATURES,
  PAID_PLANS,
  PLAN_FEATURES,
} from '@/lib/plans';

function Check() {
  return (
    <svg className="h-5 w-5 shrink-0 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function LandingPricing() {
  const [annually, setAnnually] = useState(false);

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal direction="down" className="text-center">
        <p className="landing-section-label landing-section-label-dark mx-auto">Pricing</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
          Start free. Scale when you&apos;re winning.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-600 sm:text-lg">
          Try one generation free. Paid plans unlock monthly credits and more saved products — checkout on Whop.
        </p>
      </Reveal>

      <Reveal direction="up" delayMs={100} className="mt-10 flex justify-center">
        <div className="landing-pricing-toggle inline-flex rounded-full border border-slate-200/80 bg-white p-1 shadow-lg shadow-slate-200/40">
          <button
            type="button"
            onClick={() => setAnnually(false)}
            className={cn(
              'rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-300',
              !annually ? 'landing-pricing-toggle-active text-white' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnually(true)}
            className={cn(
              'rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-300',
              annually ? 'landing-pricing-toggle-active text-white' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Annually
          </button>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        <Reveal direction="up" delayMs={0}>
          <article className="landing-pricing-card relative flex h-full flex-col overflow-hidden rounded-3xl p-8 sm:p-7">
            <h3 className="text-xl font-bold text-slate-900">Free trial</h3>
            <p className="mt-1 text-sm text-slate-500">Try the full flow once</p>
            <p className="mt-8 text-2xl font-bold tracking-tight text-slate-900">No card required</p>
            <ul className="mt-8 flex-1 space-y-3.5 text-sm text-slate-600">
              {FREE_PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <a
              href="/login?next=/app"
              className="mt-10 inline-flex w-full items-center justify-center rounded-2xl border-2 border-slate-900 bg-white py-4 text-base font-semibold text-slate-900 transition-all duration-300 hover:bg-slate-50"
            >
              Get started
            </a>
          </article>
        </Reveal>

        {PAID_PLANS.map((plan, i) => {
          const isFeatured = plan.key === 'pro';
          const href = `/login?next=checkout&plan=${annually ? plan.checkoutYearly : plan.checkoutMonthly}`;

          return (
            <Reveal key={plan.key} direction={i % 2 === 0 ? 'up' : 'down'} delayMs={(i + 1) * 90}>
              <article
                className={cn(
                  'landing-pricing-card relative flex h-full flex-col overflow-hidden rounded-3xl p-8 sm:p-7',
                  isFeatured && 'landing-pricing-card-featured'
                )}
              >
                {isFeatured && (
                  <span className="absolute right-6 top-6 rounded-full bg-[var(--brand-gradient)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {plan.credits} credits · {plan.maxProducts} products
                </p>
                <p className="mt-8 text-sm font-medium text-slate-500">
                  Price on Whop checkout
                </p>
                <ul className="mt-6 flex-1 space-y-3.5 text-sm text-slate-600">
                  {PLAN_FEATURES(plan).map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <Check />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={href}
                  className={cn(
                    'mt-10 inline-flex w-full items-center justify-center rounded-2xl py-4 text-base font-semibold transition-all duration-300',
                    isFeatured
                      ? 'landing-btn-primary shadow-lg'
                      : 'border-2 border-slate-900 bg-white text-slate-900 hover:bg-slate-50'
                  )}
                >
                  Subscribe
                </a>
              </article>
            </Reveal>
          );
        })}
      </div>

      <Reveal direction="up" delayMs={120} className="mt-8 text-center">
        <p className="text-sm text-slate-500">Each generate uses 1 credit. Cancel anytime from your dashboard.</p>
      </Reveal>

      <Reveal direction="down" delayMs={180}>
        <div className="landing-pricing-contact mt-14 rounded-3xl p-8 text-center sm:p-10">
          <p className="text-lg font-medium text-slate-800 sm:text-xl">
            Need a custom plan or team access?
          </p>
          <a
            href={process.env.NEXT_PUBLIC_TELEGRAM_FOUNDER ?? 'https://t.me/yourusername'}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#0088cc] px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] hover:bg-[#0077b5]"
          >
            Chat with founder
          </a>
        </div>
      </Reveal>
    </div>
  );
}
