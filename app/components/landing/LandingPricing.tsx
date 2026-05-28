'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Reveal } from './Reveal';

const PLANS = [
  {
    id: 'free',
    name: 'Free Trial',
    tagline: '1 generation',
    monthly: 0,
    annualMonthly: 0,
    annualNote: null,
    features: ['1 free generation', 'All aspect ratios', 'History & download'],
    cta: 'Get started',
    href: '/login?next=/app',
    style: 'default' as const,
  },
  {
    id: 'standard',
    name: 'Standard',
    tagline: '20 AI images / month',
    monthly: 9.99,
    annualMonthly: 6.67,
    annualNote: 'Billed $79.99/year',
    features: ['20 AI images (generate or edit)', 'All aspect ratios', 'History & download'],
    cta: 'Subscribe',
    hrefMonthly: '/login?next=checkout&plan=standard_monthly',
    hrefAnnual: '/login?next=checkout&plan=standard_yearly',
    style: 'default' as const,
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: '75 AI images / month',
    monthly: 29.99,
    annualMonthly: 19.17,
    annualNote: 'Billed $229.99/year',
    features: ['75 AI images (generate or edit)', 'All aspect ratios', 'History & download'],
    cta: 'Subscribe',
    hrefMonthly: '/login?next=checkout&plan=pro_monthly',
    hrefAnnual: '/login?next=checkout&plan=pro_yearly',
    style: 'featured' as const,
  },
];

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
          One free generation to try the flow. Paid plans unlock monthly credits instantly after checkout.
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
              'flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-300',
              annually ? 'landing-pricing-toggle-active text-white' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Annually
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              −33%
            </span>
          </button>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:gap-8">
        {PLANS.map((plan, i) => {
          const isFeatured = plan.style === 'featured';
          const price = annually ? plan.annualMonthly : plan.monthly;
          const href =
            plan.id === 'free'
              ? plan.href!
              : annually
                ? plan.hrefAnnual!
                : plan.hrefMonthly!;

          return (
            <Reveal key={plan.id} direction={i % 2 === 0 ? 'up' : 'down'} delayMs={i * 90}>
              <article
                className={cn(
                  'landing-pricing-card relative flex h-full flex-col overflow-hidden rounded-3xl p-8 sm:p-9',
                  isFeatured && 'landing-pricing-card-featured'
                )}
              >
                {isFeatured && (
                  <span className="absolute right-6 top-6 rounded-full bg-[var(--brand-gradient)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{plan.tagline}</p>
                <div className="mt-8">
                  {price === 0 ? (
                    <p className="text-5xl font-bold tracking-tight text-slate-900">$0</p>
                  ) : (
                    <>
                      <p className="flex items-baseline gap-1">
                        <span className="text-5xl font-bold tracking-tight text-slate-900">
                          ${price.toFixed(price % 1 ? 2 : 0)}
                        </span>
                        <span className="text-slate-500">/ mo</span>
                      </p>
                      {annually && plan.annualNote && (
                        <p className="mt-1 text-sm text-slate-500">{plan.annualNote}</p>
                      )}
                    </>
                  )}
                </div>
                <ul className="mt-8 flex-1 space-y-3.5 text-sm text-slate-600">
                  {plan.features.map((f) => (
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
                  {plan.cta}
                </a>
              </article>
            </Reveal>
          );
        })}
      </div>

      <Reveal direction="up" delayMs={120} className="mt-8 text-center">
        <p className="text-sm text-slate-500">Editing an image counts as one generation.</p>
      </Reveal>

      <Reveal direction="down" delayMs={180}>
        <div className="landing-pricing-contact mt-14 rounded-3xl p-8 text-center sm:p-10">
          <p className="text-lg font-medium text-slate-800 sm:text-xl">
            Need a custom credit pack or team plan?
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
