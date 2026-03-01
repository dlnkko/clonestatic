import Link from 'next/link';

const CHECKOUT = {
  standardMonthly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_STANDARD_MONTHLY || 'https://whop.com/checkout/plan_1qy7pizl7xAkx',
  standardYearly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_STANDARD_YEARLY || 'https://whop.com/checkout/plan_KRjrbQ6Z0D2A5',
  proMonthly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_PRO_MONTHLY || 'https://whop.com/checkout/plan_xb9A75BEfcTGk',
  proYearly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_PRO_YEARLY || 'https://whop.com/checkout/plan_CNk2XegENVQGM',
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f0f9ff] landing-mesh">
      {/* Hero */}
      <section className="relative overflow-hidden landing-gradient">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.03)_100%)]" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 py-20 sm:py-28 text-center">
          <h1
            className="text-4xl font-bold tracking-tight text-white drop-shadow-sm sm:text-5xl md:text-6xl animate-fade-in-up opacity-0"
            style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}
          >
            AI Ad Prompt Generator
          </h1>
          <p
            className="mt-5 text-lg text-white/90 max-w-2xl mx-auto sm:text-xl animate-fade-in-up opacity-0"
            style={{ animationDelay: '0.25s', animationFillMode: 'forwards' }}
          >
            Turn any reference ad into a custom AI prompt. Upload your product, pick a style, and generate scroll-stopping creatives in minutes.
          </p>
          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-4 animate-fade-in-up opacity-0"
            style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}
          >
            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-[#0369a1] shadow-xl shadow-black/10 transition-smooth hover:bg-white/95 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/15"
            >
              Launch App
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center rounded-xl border-2 border-white/80 bg-white/10 px-6 py-3.5 text-base font-medium text-white backdrop-blur-sm transition-smooth hover:bg-white/20 hover:border-white"
            >
              See plans
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:py-24">
        <h2
          className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl animate-fade-in-up opacity-0"
          style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}
        >
          Why creators choose us
        </h2>
        <p
          className="mx-auto mt-3 max-w-xl text-center text-slate-600 animate-fade-in-up opacity-0"
          style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}
        >
          Reference + product, 2K output, and brand-aware prompts in one flow.
        </p>
        <div className="mt-14 grid gap-8 sm:grid-cols-3 text-center">
          {[
            {
              icon: (
                <svg className="h-7 w-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ),
              title: 'Reference + product',
              desc: 'Upload a reference ad and your product image. We generate the prompt and the final creative.',
              delay: '0.3s',
            },
            {
              icon: (
                <svg className="h-7 w-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ),
              title: '2K output',
              desc: 'High-resolution 2K images. Choose vertical 9:16, horizontal 16:9, square 1:1, or match your reference.',
              delay: '0.45s',
            },
            {
              icon: (
                <svg className="h-7 w-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              ),
              title: 'Brand-aware',
              desc: 'Paste your product URL and we scrape copy and branding so the ad stays on-brand.',
              delay: '0.6s',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="group relative flex flex-col rounded-2xl border border-slate-200/80 bg-white/90 p-8 shadow-sm backdrop-blur-sm transition-smooth hover-lift animate-fade-in-up opacity-0"
              style={{ animationDelay: item.delay, animationFillMode: 'forwards' }}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0ea5e9] to-[#0369a1] text-white shadow-lg shadow-blue-500/25 transition-smooth group-hover:scale-110 group-hover:shadow-blue-500/30">
                {item.icon}
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative border-t border-slate-200/80 bg-white/60 py-20 sm:py-28 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <h2
            className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl animate-fade-in-up opacity-0"
            style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}
          >
            Simple pricing
          </h2>
          <p
            className="mt-3 text-slate-600 animate-fade-in-up opacity-0"
            style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}
          >
            Choose monthly or yearly. After payment you get instant access with your credits.
          </p>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 sm:gap-8 lg:gap-10">
            {/* Standard */}
            <div
              className="relative flex flex-col rounded-2xl border-2 border-slate-200 bg-white p-8 shadow-lg transition-smooth hover-lift hover-glow animate-fade-in-up opacity-0"
              style={{ animationDelay: '0.35s', animationFillMode: 'forwards' }}
            >
              <h3 className="text-xl font-semibold text-slate-900">Standard</h3>
              <p className="mt-1 text-sm text-slate-500">25 images per month</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-2">25 AI-generated ad images</li>
                <li className="flex items-center gap-2">2K resolution</li>
                <li className="flex items-center gap-2">All aspect ratios</li>
                <li className="flex items-center gap-2">History & download</li>
              </ul>
              <div className="mt-8 space-y-3">
                <a
                  href={CHECKOUT.standardMonthly}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#0284c7] to-[#0369a1] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-smooth hover:shadow-blue-500/40 hover:scale-[1.02]"
                >
                  $9.99 / month
                </a>
                <a
                  href={CHECKOUT.standardYearly}
                  className="inline-flex w-full items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-700 transition-smooth hover:border-[#0ea5e9] hover:bg-slate-50"
                >
                  $79.99 / year
                </a>
              </div>
            </div>

            {/* Pro */}
            <div
              className="relative flex flex-col rounded-2xl border-2 border-[#0ea5e9] bg-white p-8 shadow-xl shadow-blue-500/10 transition-smooth hover-lift hover-glow animate-fade-in-up opacity-0 ring-2 ring-[#0ea5e9]/20"
              style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] px-4 py-1 text-xs font-semibold text-white shadow-md">
                Popular
              </span>
              <h3 className="text-xl font-semibold text-slate-900">Pro</h3>
              <p className="mt-1 text-sm text-slate-500">100 images per month</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-2">100 AI-generated ad images</li>
                <li className="flex items-center gap-2">2K resolution</li>
                <li className="flex items-center gap-2">All aspect ratios</li>
                <li className="flex items-center gap-2">History & download</li>
              </ul>
              <div className="mt-8 space-y-3">
                <a
                  href={CHECKOUT.proMonthly}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-smooth hover:shadow-blue-500/40 hover:scale-[1.02]"
                >
                  $29.99 / month
                </a>
                <a
                  href={CHECKOUT.proYearly}
                  className="inline-flex w-full items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-700 transition-smooth hover:border-[#0ea5e9] hover:bg-slate-50"
                >
                  $229.99 / year
                </a>
              </div>
            </div>
          </div>

          <div
            className="mt-12 rounded-2xl border border-slate-200 bg-white/90 p-6 sm:p-8 text-left max-w-2xl mx-auto shadow-sm transition-smooth hover:shadow-md animate-fade-in-up opacity-0"
            style={{ animationDelay: '0.65s', animationFillMode: 'forwards' }}
          >
            <h3 className="text-base font-semibold text-slate-900">How it works</h3>
            <ol className="mt-4 space-y-2 text-sm text-slate-600 list-decimal list-inside">
              <li><strong>Pay button</strong> → Redirects you to Whop checkout.</li>
              <li><strong>Whop charges</strong> → You pay securely on Whop&apos;s page.</li>
              <li><strong>Webhook notifies us</strong> → Our endpoint receives the event and activates your access with the right credits.</li>
            </ol>
            <p className="mt-4 text-sm text-slate-500">Use the same email you paid with to access the app.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-slate-200/80 py-20 sm:py-24 landing-mesh">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Ready to create?</h2>
          <p className="mt-3 text-slate-600">Launch the app to try the interface, or pick a plan above to get credits.</p>
          <Link
            href="/app"
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#0369a1] to-[#0c4a6e] px-8 py-4 text-base font-semibold text-white shadow-xl shadow-blue-900/25 transition-smooth hover:scale-[1.03] hover:shadow-2xl hover:shadow-blue-900/30"
          >
            Launch App →
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200/80 py-8 bg-white/50">
        <div className="mx-auto max-w-4xl px-4 text-center text-sm text-slate-500">
          AI Ad Prompt Generator · Payments powered by Whop
        </div>
      </footer>
    </main>
  );
}
