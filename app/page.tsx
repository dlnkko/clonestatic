import { BeforeAfterSlider } from './components/BeforeAfterSlider';
import { PricingSection } from './components/PricingSection';

const CHECKOUT = {
  standardMonthly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_STANDARD_MONTHLY || 'https://whop.com/checkout/plan_1qy7pizl7xAkx',
  standardYearly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_STANDARD_YEARLY || 'https://whop.com/checkout/plan_KRjrbQ6Z0D2A5',
  proMonthly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_PRO_MONTHLY || 'https://whop.com/checkout/plan_xb9A75BEfcTGk',
  proYearly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_PRO_YEARLY || 'https://whop.com/checkout/plan_CNk2XegENVQGM',
};

const NAV_LINKS = [
  { label: 'Home', href: '#' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen landing-dark landing-dark-grid text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 landing-glass">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <a href="#" className="text-lg font-bold tracking-tight text-sky-400 transition-colors hover:text-sky-300">
            AI Ad Generator
          </a>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="relative flex items-center gap-3">
            <details className="sm:hidden">
              <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white/80 hover:bg-white/10 [&::-webkit-details-marker]:hidden">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </summary>
              <div className="absolute right-0 top-full mt-2 flex w-48 flex-col rounded-xl border border-white/10 bg-slate-900/95 py-2 shadow-xl backdrop-blur-xl">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </details>
            <a
              href="#pricing"
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:bg-sky-400 hover:shadow-sky-500/30"
            >
              See plans
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-4 pt-12 pb-8 sm:pt-16 sm:pb-12">
        <div className="mx-auto max-w-3xl text-center">
          <p
            className="inline-block rounded-full bg-sky-500/15 px-4 py-1.5 text-xs font-medium text-sky-300 animate-fade-in-up opacity-0"
            style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}
          >
            Trusted by creators who scale with AI
          </p>
          <h1
            className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl animate-fade-in-up opacity-0"
            style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}
          >
            Ad creatives,{' '}
            <span className="text-sky-400">built with strategy</span>
          </h1>
          <p
            className="mt-4 text-lg text-white/70 sm:text-xl animate-fade-in-up opacity-0"
            style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}
          >
            Turn any reference ad into a custom AI prompt. Upload your product, pick a style, and generate scroll-stopping creatives in minutes.
          </p>
          <div
            className="mt-8 flex flex-wrap items-center justify-center gap-3 animate-fade-in-up opacity-0"
            style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}
          >
            <a
              href="#pricing"
              className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-sky-500/25 transition-smooth hover:bg-sky-400 hover:scale-[1.02]"
            >
              See plans
            </a>
            <a
              href="#compare"
              className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/5 px-6 py-3.5 text-base font-medium text-white backdrop-blur-sm transition-smooth hover:bg-white/10"
            >
              View example
            </a>
          </div>
        </div>
      </section>

      {/* Before/After slider: Original design (OMNI) ← → AI generated (Bloom) */}
      <section id="compare" className="px-4 py-12 sm:py-16">
        <p className="mx-auto max-w-2xl text-center text-sm text-white/60">
          Drag to compare: original design → AI-generated creative
        </p>
        <div className="mt-6 animate-fade-in-up opacity-0" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
          <BeforeAfterSlider
            imageBefore="/original-design.png"
            imageAfter="/ai-generated.png"
            labelBefore="Original design"
            labelAfter="AI generated"
          />
        </div>
      </section>

      {/* Pricing - fondo claro, toggle Monthly/Annually, tarjetas blancas, checkmarks azul */}
      <section id="pricing" className="border-t border-white/5 bg-gradient-to-b from-slate-50 to-white px-4 py-16 sm:py-20">
        <div className="text-slate-900">
          <PricingSection
            standardMonthly={CHECKOUT.standardMonthly}
            standardYearly={CHECKOUT.standardYearly}
            proMonthly={CHECKOUT.proMonthly}
            proYearly={CHECKOUT.proYearly}
          />
        </div>
      </section>

      {/* Core features - una tarjeta azul destacada + dos blancas con mockup/visual */}
      <section id="features" className="border-t border-slate-200 bg-white px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            What you get
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
            Reference + product, 2K output, and brand-aware prompts in one flow.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            {/* Hero card - azul vibrante con visual */}
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-xl shadow-blue-500/20 sm:p-8 md:col-span-2">
              <h3 className="text-lg font-semibold">Reference + product</h3>
              <p className="mt-2 text-sm text-blue-100 leading-relaxed">
                Upload a reference ad and your product image. We generate the prompt and the final creative.
              </p>
              <div className="mt-6 rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                    </svg>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="h-2 w-full rounded bg-white/30" />
                    <div className="h-2 w-2/3 rounded bg-white/20" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-blue-100">Reference → Prompt → Creative</p>
              </div>
            </div>
            {/* Tarjeta blanca - 2K output */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50 transition-shadow hover:shadow-xl sm:p-8">
              <h3 className="text-lg font-semibold text-slate-900">2K output</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                High-resolution 2K images. Choose vertical 9:16, horizontal 16:9, square 1:1, or match your reference.
              </p>
              <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex gap-2">
                  <div className="h-12 w-9 rounded bg-slate-200/80" title="9:16" />
                  <div className="h-12 w-16 rounded bg-slate-200/80" title="16:9" />
                  <div className="h-12 w-12 rounded bg-slate-200/80" title="1:1" />
                </div>
                <p className="mt-2 text-xs text-slate-500">All aspect ratios</p>
              </div>
            </div>
            {/* Tarjeta blanca - Brand-aware */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50 transition-shadow hover:shadow-xl sm:p-8">
              <h3 className="text-lg font-semibold text-slate-900">Brand-aware</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Paste your product URL and we scrape copy and branding so the ad stays on-brand.
              </p>
              <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-600">
                  <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="text-xs font-medium">Product URL → Copy + branding</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Ready to create?</h2>
          <p className="mt-3 text-white/60">Pick a plan above to get credits and start generating ad creatives.</p>
          <a
            href="#pricing"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-sky-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-sky-500/25 transition-smooth hover:bg-sky-400 hover:scale-[1.02]"
          >
            Choose a plan
          </a>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-4xl px-4 text-center text-sm text-white/50">
          AI Ad Prompt Generator · Payments powered by Whop
        </div>
      </footer>
    </main>
  );
}
