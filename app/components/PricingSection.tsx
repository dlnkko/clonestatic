'use client';

import { useState } from 'react';

const CHECKMARK = (
  <svg className="h-5 w-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

export function PricingSection() {
  const [annually, setAnnually] = useState(false);

  return (
    <div className="mx-auto max-w-5xl">
      <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
        Simple pricing
      </h2>
      <p className="mt-3 text-center text-slate-600 sm:text-lg">
        Try one generation free, or choose a plan. After payment you get instant access with your credits.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setAnnually(false)}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${!annually ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnually(true)}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${annually ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Annually
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
              Save 33%
            </span>
          </button>
        </div>
      </div>

      <div className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-10">
        {/* Free Trial */}
        <div className="relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/30 transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/40 sm:p-10">
          <h3 className="text-xl font-bold text-slate-900">Free Trial</h3>
          <p className="mt-1 text-sm text-slate-500">1 generation only</p>
          <p className="mt-6 flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight text-slate-900">$0</span>
          </p>
          <ul className="mt-8 space-y-4 text-sm text-slate-600">
            <li className="flex items-start gap-3">
              {CHECKMARK}
              <span>1 free generation</span>
            </li>
            <li className="flex items-start gap-3">
              {CHECKMARK}
              <span>All aspect ratios</span>
            </li>
            <li className="flex items-start gap-3">
              {CHECKMARK}
              <span>History & download</span>
            </li>
          </ul>
          <div className="mt-10">
            <a
              href="/login?next=/app"
              className="inline-flex w-full items-center justify-center rounded-2xl border-2 border-slate-900 bg-white px-5 py-4 text-base font-semibold text-slate-900 transition-colors hover:bg-slate-50"
            >
              Get started
            </a>
          </div>
        </div>

        {/* Standard */}
        <div className="relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200/50 sm:p-10">
          <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-slate-100/80" aria-hidden />
          <h3 className="text-xl font-bold text-slate-900">Standard</h3>
          <p className="mt-1 text-sm text-slate-500">20 AI images per month</p>
          {!annually ? (
            <p className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-slate-900">$9.99</span>
              <span className="text-slate-500">/ month</span>
            </p>
          ) : (
            <div className="mt-6">
              <p className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-slate-900">$6.67</span>
                <span className="text-slate-500">/ month</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">Billed $79.99/year</p>
            </div>
          )}
          <ul className="mt-8 space-y-4 text-sm text-slate-600">
            <li className="flex items-start gap-3">
              {CHECKMARK}
              <span>20 AI images (generate or edit)</span>
            </li>
            <li className="flex items-start gap-3">
              {CHECKMARK}
              <span>All aspect ratios</span>
            </li>
            <li className="flex items-start gap-3">
              {CHECKMARK}
              <span>History & download</span>
            </li>
          </ul>
          <div className="mt-10">
            <a
              href={annually ? '/login?next=checkout&plan=standard_yearly' : '/login?next=checkout&plan=standard_monthly'}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-4 text-base font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Subscribe
            </a>
          </div>
        </div>

        {/* Pro */}
        <div className="relative flex flex-col overflow-hidden rounded-3xl border-2 border-sky-200 bg-white p-8 shadow-xl shadow-sky-100/50 transition-all duration-300 hover:border-sky-300 hover:shadow-2xl hover:shadow-sky-100/60 sm:p-10">
          <span className="absolute right-6 top-6 rounded-full bg-sky-500 px-3 py-1 text-xs font-bold text-white">
            Popular
          </span>
          <div className="absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full bg-sky-50/90" aria-hidden />
          <h3 className="text-xl font-bold text-slate-900">Pro</h3>
          <p className="mt-1 text-sm text-slate-500">75 AI images per month</p>
          {!annually ? (
            <p className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-slate-900">$29.99</span>
              <span className="text-slate-500">/ month</span>
            </p>
          ) : (
            <div className="mt-6">
              <p className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-slate-900">$19.17</span>
                <span className="text-slate-500">/ month</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">Billed $229.99/year</p>
            </div>
          )}
          <ul className="mt-8 space-y-4 text-sm text-slate-600">
            <li className="flex items-start gap-3">
              {CHECKMARK}
              <span>75 AI images (generate or edit)</span>
            </li>
            <li className="flex items-start gap-3">
              {CHECKMARK}
              <span>All aspect ratios</span>
            </li>
            <li className="flex items-start gap-3">
              {CHECKMARK}
              <span>History & download</span>
            </li>
          </ul>
          <div className="mt-10">
            <a
              href={annually ? '/login?next=checkout&plan=pro_yearly' : '/login?next=checkout&plan=pro_monthly'}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-sky-500 px-5 py-4 text-base font-semibold text-white shadow-lg shadow-sky-500/25 transition-colors hover:bg-sky-600"
            >
              Subscribe
            </a>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Editing an image counts as one generation.
      </p>

      <div className="mt-16 rounded-2xl border border-slate-200 bg-slate-50/80 p-6 sm:p-8 text-center">
        <p className="text-slate-700 sm:text-lg">
          Want a custom deal or a specific number of credits? Chat with us.
        </p>
        <a
          href={process.env.NEXT_PUBLIC_TELEGRAM_FOUNDER ?? 'https://t.me/yourusername'}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0088cc] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#0077b5]"
        >
          Chat with founder
        </a>
      </div>
    </div>
  );
}
