'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  CREDIT_PACK_OPTIONS,
  PAID_PLANS,
  planDisplayPrice,
  planFeatureList,
  type BillingPeriod,
} from '@/lib/plans';

function Check() {
  return (
    <svg
      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--landing-accent)]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
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
    <div className="inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.03] p-0.5">
      <button
        type="button"
        onClick={() => onChange('monthly')}
        className={cn(
          'rounded px-3 py-1.5 text-xs font-medium transition-colors',
          billing === 'monthly' ? 'bg-white text-zinc-900' : 'text-white/55 hover:text-white'
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange('yearly')}
        className={cn(
          'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors',
          billing === 'yearly' ? 'bg-white text-zinc-900' : 'text-white/55 hover:text-white'
        )}
      >
        Annual
        <span
          className={cn(
            'text-[9px] font-semibold uppercase tracking-wide',
            billing === 'yearly' ? 'text-zinc-500' : 'text-[var(--landing-accent)]'
          )}
        >
          −20%
        </span>
      </button>
    </div>
  );
}

function CreditPackSlider() {
  const [index, setIndex] = useState(0);
  const pack = CREDIT_PACK_OPTIONS[index] ?? CREDIT_PACK_OPTIONS[0];
  const buyHref = `/login?next=checkout&plan=${pack.checkoutKey}`;
  const progress = (index / Math.max(CREDIT_PACK_OPTIONS.length - 1, 1)) * 100;
  const pricePerCredit = pack.priceUsd / pack.credits;

  const ticks = useMemo(
    () =>
      CREDIT_PACK_OPTIONS.map((p, i) => ({
        i,
        label: String(p.credits),
        show: true,
      })),
    []
  );

  return (
    <article className="landing-window overflow-hidden rounded-xl border border-white/[0.08] bg-[#080c18]/90 p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            One-time credits
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-[var(--landing-fg)] sm:text-lg">
            Pay once. Ship ads.
          </h3>
          <p className="mt-0.5 text-xs text-white/40">1 credit = 1 image · no subscription</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/55">
            Credits only — seats and saved-product limits come with monthly plans.
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-2xl font-semibold tracking-tight text-[var(--landing-fg)] tabular-nums">
            {pack.credits}
            <span className="ml-1 text-sm font-medium text-white/40">credits</span>
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-white/50">
            ${pricePerCredit.toFixed(2)} / credit
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label className="sr-only" htmlFor="credit-pack-slider">
          Select credits
        </label>
        <input
          id="credit-pack-slider"
          type="range"
          min={0}
          max={CREDIT_PACK_OPTIONS.length - 1}
          step={1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="landing-credit-slider landing-credit-slider-sm w-full"
          style={{
            background: `linear-gradient(90deg, rgba(34,211,238,0.75) 0%, rgba(34,211,238,0.75) ${progress}%, rgba(255,255,255,0.1) ${progress}%, rgba(255,255,255,0.1) 100%)`,
          }}
        />
        <div className="mt-2 flex justify-between gap-0.5 overflow-x-auto px-0.5 text-[9px] tabular-nums text-white/30 sm:text-[10px]">
          {ticks.map((t) => (
            <button
              key={t.i}
              type="button"
              onClick={() => setIndex(t.i)}
              className={cn(
                'shrink-0 transition-colors hover:text-white/70',
                t.i === index && 'font-semibold text-[var(--landing-accent)]'
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
          className="landing-btn-gold inline-flex w-full items-center justify-center px-8 py-3.5 text-lg font-semibold tabular-nums tracking-tight sm:w-auto sm:min-w-[11rem]"
        >
          ${pack.priceUsd.toFixed(2)}
        </a>
      </div>
    </article>
  );
}

export function LandingPricing() {
  const [billing, setBilling] = useState<BillingPeriod>('monthly');

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mx-auto max-w-lg text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--landing-fg)] sm:text-3xl">
          Simple pricing. Ship more.
        </h2>
        <p className="mt-2 text-sm text-white/50">Buy credits once, or pick a monthly plan.</p>
      </div>

      <div className="mt-8">
        <CreditPackSlider />
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
          Or subscribe monthly
        </p>
        <BillingToggle billing={billing} onChange={setBilling} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {PAID_PLANS.map((plan) => {
          const isFeatured = plan.badge === 'popular';
          const price = planDisplayPrice(plan, billing);
          const href = `/login?next=checkout&plan=${billing === 'yearly' ? plan.checkoutYearly : plan.checkoutMonthly}`;

          return (
            <article
              key={plan.key}
              className={cn(
                'landing-price-card relative flex flex-col rounded-xl border p-4',
                isFeatured
                  ? 'border-[var(--landing-accent)]/35 bg-[var(--landing-accent)]/[0.06]'
                  : 'border-white/[0.08] bg-white/[0.03]'
              )}
            >
              {isFeatured && (
                <span className="absolute right-3 top-3 rounded bg-[var(--brand-indigo)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  Most popular
                </span>
              )}
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40">
                {plan.name}
              </p>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tracking-tight text-[var(--landing-fg)]">
                  ${price.amount}
                </span>
                <span className="text-xs text-white/45">{price.suffix}</span>
              </p>
              {price.sublabel && (
                <p className="mt-0.5 text-[11px] font-medium text-[var(--landing-accent)]">
                  {price.sublabel}
                </p>
              )}
              <ul className="mt-3 flex-1 space-y-1.5 text-xs text-white/60">
                {planFeatureList(plan).map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={href}
                className={cn(
                  'mt-4 inline-flex w-full justify-center',
                  isFeatured
                    ? 'landing-btn-gold landing-btn-compact'
                    : 'landing-btn-outline landing-btn-compact'
                )}
              >
                Get started
              </a>
            </article>
          );
        })}
      </div>

      <p className="mt-5 text-center text-[11px] text-white/30">1 credit = 1 image · Cancel anytime</p>
    </div>
  );
}
