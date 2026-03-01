import Link from 'next/link';

const CHECKOUT = {
  standardMonthly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_STANDARD_MONTHLY || 'https://whop.com/checkout/plan_1qy7pizl7xAkx',
  standardYearly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_STANDARD_YEARLY || 'https://whop.com/checkout/plan_KRjrbQ6Z0D2A5',
  proMonthly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_PRO_MONTHLY || 'https://whop.com/checkout/plan_xb9A75BEfcTGk',
  proYearly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_PRO_YEARLY || 'https://whop.com/checkout/plan_CNk2XegENVQGM',
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      {/* Hero */}
      <section className="border-b border-[var(--border)] bg-[var(--card-bg)]">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:py-24 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            AI Ad Prompt Generator
          </h1>
          <p className="mt-4 text-lg text-slate-600 sm:text-xl max-w-2xl mx-auto">
            Turn any reference ad into a custom AI prompt. Upload your product, pick a style, and generate scroll-stopping creatives in minutes.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-6 py-3.5 text-base font-medium text-white shadow-lg shadow-blue-200/40 transition hover:bg-[var(--primary-hover)]"
            >
              Launch App
            </Link>
            <a href="#pricing" className="inline-flex items-center justify-center rounded-xl border-2 border-[var(--border)] bg-white px-6 py-3.5 text-base font-medium text-slate-700 transition hover:bg-slate-50">
              See plans
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
        <div className="grid gap-10 sm:grid-cols-3 text-center">
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--primary)]">
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Reference + product</h3>
            <p className="mt-1 text-sm text-slate-500">Upload a reference ad and your product image. We generate the prompt and the final creative.</p>
          </div>
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--primary)]">
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">2K output</h3>
            <p className="mt-1 text-sm text-slate-500">High-resolution 2K images. Choose vertical 9:16, horizontal 16:9, square 1:1, or match your reference.</p>
          </div>
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--primary)]">
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Brand-aware</h3>
            <p className="mt-1 text-sm text-slate-500">Paste your product URL and we scrape copy and branding so the ad stays on-brand.</p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-[var(--border)] bg-slate-50/50 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Simple pricing</h2>
          <p className="mt-2 text-slate-600">Choose monthly or yearly. After payment you get instant access with your credits.</p>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 sm:gap-6 lg:gap-8">
            {/* Standard */}
            <div className="relative flex flex-col rounded-2xl border-2 border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-sm ring-1 ring-slate-200/30 sm:p-8">
              <h3 className="text-lg font-semibold text-slate-900">Standard</h3>
              <p className="mt-1 text-sm text-slate-500">25 images per month</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-2">25 AI-generated ad images</li>
                <li className="flex items-center gap-2">2K resolution</li>
                <li className="flex items-center gap-2">All aspect ratios</li>
                <li className="flex items-center gap-2">History & download</li>
              </ul>
              <div className="mt-6 space-y-3">
                <a href={CHECKOUT.standardMonthly} className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3.5 text-sm font-medium text-white shadow-md transition hover:bg-[var(--primary-hover)]">
                  $9.99 / month
                </a>
                <a href={CHECKOUT.standardYearly} className="inline-flex w-full items-center justify-center rounded-xl border-2 border-[var(--border)] bg-white px-4 py-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  $79.99 / year
                </a>
              </div>
            </div>

            {/* Pro */}
            <div className="relative flex flex-col rounded-2xl border-2 border-[var(--primary)] bg-[var(--card-bg)] p-6 shadow-lg ring-2 ring-[var(--primary)]/20 sm:p-8">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--primary)] px-3 py-0.5 text-xs font-medium text-white">Popular</span>
              <h3 className="text-lg font-semibold text-slate-900">Pro</h3>
              <p className="mt-1 text-sm text-slate-500">100 images per month</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-2">100 AI-generated ad images</li>
                <li className="flex items-center gap-2">2K resolution</li>
                <li className="flex items-center gap-2">All aspect ratios</li>
                <li className="flex items-center gap-2">History & download</li>
              </ul>
              <div className="mt-6 space-y-3">
                <a href={CHECKOUT.proMonthly} className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3.5 text-sm font-medium text-white shadow-md transition hover:bg-[var(--primary-hover)]">
                  $29.99 / month
                </a>
                <a href={CHECKOUT.proYearly} className="inline-flex w-full items-center justify-center rounded-xl border-2 border-[var(--border)] bg-white px-4 py-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  $229.99 / year
                </a>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 sm:p-6 text-left max-w-2xl mx-auto">
            <h3 className="text-sm font-semibold text-slate-900">How it works</h3>
            <ol className="mt-3 space-y-2 text-sm text-slate-600 list-decimal list-inside">
              <li><strong>Pay button</strong> → Redirects you to Whop checkout.</li>
              <li><strong>Whop charges</strong> → You pay securely on Whop’s page.</li>
              <li><strong>Webhook notifies us</strong> → Our endpoint receives the event and activates your access with the right credits.</li>
            </ol>
            <p className="mt-4 text-sm text-slate-500">Use the same email you paid with to access the app.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--border)] py-12 sm:py-16">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-xl font-semibold text-slate-900">Ready to create?</h2>
          <p className="mt-2 text-slate-600">Launch the app to try the interface, or pick a plan above to get credits.</p>
          <Link href="/app" className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-medium text-white transition hover:bg-slate-800">
            Launch App →
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-8">
        <div className="mx-auto max-w-4xl px-4 text-center text-sm text-slate-500">
          AI Ad Prompt Generator · Payments powered by Whop
        </div>
      </footer>
    </main>
  );
}
