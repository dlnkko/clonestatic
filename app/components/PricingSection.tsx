'use client';

import { useState } from 'react';

const CHECKMARK = (
  <svg className="h-5 w-5 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

type Props = {
  standardMonthly: string;
  standardYearly: string;
  proMonthly: string;
  proYearly: string;
};

export function PricingSection({
  standardMonthly,
  standardYearly,
  proMonthly,
  proYearly,
}: Props) {
  const [annually, setAnnually] = useState(false);

  return (
    <div className="mx-auto max-w-5xl">
      <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        Simple pricing
      </h2>
      <p className="mt-3 text-center text-slate-600">
        Choose monthly or yearly. After payment you get instant access with your credits.
      </p>

      {/* Toggle: Monthly | Annually (recalcar descuento) */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setAnnually(false)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${!annually ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnually(true)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${annually ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Annually
            <span className="rounded bg-blue-500 px-1.5 py-0.5 text-xs font-semibold text-white">
              -33%
            </span>
          </button>
        </div>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:gap-8">
        {/* Standard */}
        <div className="relative flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50 sm:p-8 transition-shadow hover:shadow-xl">
          <span className="absolute -top-3 right-6 rounded-full bg-slate-800 px-3 py-0.5 text-xs font-semibold text-white">
            Save 33%
          </span>
          <h3 className="text-lg font-semibold text-slate-900">Standard</h3>
          <p className="mt-1 text-sm text-slate-500">25 images per month</p>
          {!annually ? (
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              $9.99
              <span className="text-base font-normal text-slate-500"> / month</span>
            </p>
          ) : (
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              $79.99
              <span className="text-base font-normal text-slate-500"> / year</span>
            </p>
          )}
          {annually && (
            <p className="mt-0.5 text-sm text-slate-500">Billed annually · ~$6.67/mo</p>
          )}
          <ul className="mt-6 space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-3">
              {CHECKMARK}
              <span>25 AI-generated ad images</span>
            </li>
            <li className="flex items-start gap-3">
              {CHECKMARK}
              <span>2K resolution</span>
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
          <div className="mt-8">
            <a
              href={annually ? standardYearly : standardMonthly}
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Subscribe
            </a>
          </div>
        </div>

        {/* Pro */}
        <div className="relative flex flex-col rounded-3xl border-2 border-blue-200 bg-white p-6 shadow-lg shadow-slate-200/50 sm:p-8 transition-shadow hover:shadow-xl hover:shadow-blue-100/50">
          <span className="absolute -top-3 right-6 rounded-full bg-blue-500 px-3 py-0.5 text-xs font-semibold text-white">
            Save 36%
          </span>
          <h3 className="text-lg font-semibold text-slate-900">Pro</h3>
          <p className="mt-1 text-sm text-slate-500">100 images per month</p>
          {!annually ? (
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              $29.99
              <span className="text-base font-normal text-slate-500"> / month</span>
            </p>
          ) : (
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              $229.99
              <span className="text-base font-normal text-slate-500"> / year</span>
            </p>
          )}
          {annually && (
            <p className="mt-0.5 text-sm text-slate-500">Billed annually · ~$19.17/mo</p>
          )}
          <ul className="mt-6 space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-3">
              {CHECKMARK}
              <span>100 AI-generated ad images</span>
            </li>
            <li className="flex items-start gap-3">
              {CHECKMARK}
              <span>2K resolution</span>
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
          <div className="mt-8">
            <a
              href={annually ? proYearly : proMonthly}
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Subscribe
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
