import { ClonestaticLogo } from './components/ClonestaticLogo';
import { PricingSection } from './components/PricingSection';

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
          <a href="#" className="transition-colors hover:opacity-90">
            <ClonestaticLogo variant="light" />
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
                <a href="/app" className="border-t border-white/10 px-4 py-2.5 text-sm font-medium text-sky-400 hover:bg-white/10 sm:hidden">
                  Get Started
                </a>
              </div>
            </details>
            <a
              href="/app"
              className="hidden sm:inline-flex shrink-0 items-center justify-center rounded-full border border-white/20 px-4 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            >
              Get Started
            </a>
            <a
              href="#pricing"
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:bg-sky-400 hover:shadow-sky-500/30"
            >
              Pricing
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-4 pt-16 pb-20 sm:pt-24 sm:pb-28 md:pt-28 md:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <p
            className="inline-block rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-sky-300 animate-fade-in-up opacity-0"
            style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}
          >
            THE FASTEST WAY TO LAUNCH PROVEN ADS
          </p>
          <h1
            className="mt-8 text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.25rem] animate-fade-in-up opacity-0"
            style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}
          >
            Stop Wasting Hours on Ad Creative. Clone What Already Works.
          </h1>
          <p
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg sm:leading-relaxed md:text-xl animate-fade-in-up opacity-0"
            style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}
          >
            Upload any high-performing ad, add your product and landing page and get ready-to-publish creatives in under 5 minutes.
          </p>
          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-4 animate-fade-in-up opacity-0 sm:mt-12"
            style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}
          >
            <a
              href="/app"
              className="inline-flex items-center justify-center rounded-full bg-sky-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-sky-500/30 transition-all duration-200 hover:bg-sky-400 hover:shadow-sky-500/40 hover:scale-[1.02]"
            >
              Get Started
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center rounded-full border-2 border-white/40 bg-white/5 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/15 hover:border-white/60"
            >
              Pricing
            </a>
          </div>
        </div>
      </section>

      {/* Core features — animated, colorful icons, responsive */}
      <section id="features" className="border-t border-white/10 bg-[#fafafb] px-4 py-20 sm:py-24 md:py-28 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <header className="text-center animate-fade-in-up opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
              Launch Winning Ads Without the Agency Overhead
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-slate-600 sm:mt-5 sm:text-lg md:max-w-2xl">
              The only AI-powered workflow that scrapes real-time product data to build elite-level creatives in seconds, not days.
            </p>
          </header>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:mt-16 sm:gap-8 md:grid-cols-3 md:gap-8 lg:mt-20 lg:gap-10">
            {/* Card 1: Reference → Creative */}
            <article 
              className="group flex flex-col rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_40px_-12px_rgba(14,165,233,0.15)] hover:ring-sky-100 sm:p-8 animate-fade-in-up opacity-0"
              style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}
            >
              <div className="mb-6 flex justify-center sm:mb-8">
                <span className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-blue-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:shadow-blue-500/30">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </span>
              </div>
              <h3 className="text-[1.35rem] font-bold tracking-tight text-slate-900 transition-colors group-hover:text-blue-600">
                From Reference to High-Converting Creative
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600 sm:mt-4 sm:text-base">
                Stop staring at a blank canvas or waiting weeks for a designer. Upload any static ad that inspires you along with your product image; our engine instantly deconstructs the winning elements to generate a custom, high-fidelity creative tailored specifically for your brand.
              </p>
            </article>

            {/* Card 2: Data scraping & copy */}
            <article 
              className="group flex flex-col rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_40px_-12px_rgba(139,92,246,0.15)] hover:ring-violet-100 sm:p-8 animate-fade-in-up opacity-0"
              style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}
            >
              <div className="mb-6 flex justify-center sm:mb-8">
                <span className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-gradient-to-br from-violet-400 to-purple-600 text-white shadow-lg shadow-purple-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:shadow-purple-500/30">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <line x1="10" y1="9" x2="8" y2="9" />
                  </svg>
                </span>
              </div>
              <h3 className="text-[1.35rem] font-bold tracking-tight text-slate-900 transition-colors group-hover:text-purple-600">
                Product Page URL Scraping
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600 sm:mt-4 sm:text-base">
                Paste your Product Page URL and let our system scrape the real data. We extract your exact features, benefits, and hooks to generate hyper-accurate, hallucination-free copy for your static ads. No generic AI fluff—just your actual product.
              </p>
            </article>

            {/* Card 3: Agility */}
            <article 
              className="group flex flex-col rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_40px_-12px_rgba(16,185,129,0.15)] hover:ring-emerald-100 sm:p-8 animate-fade-in-up opacity-0"
              style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}
            >
              <div className="mb-6 flex justify-center sm:mb-8">
                <span className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-teal-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:shadow-teal-500/30">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </span>
              </div>
              <h3 className="text-[1.35rem] font-bold tracking-tight text-slate-900 transition-colors group-hover:text-teal-600">
                Agility is Your Competitive Advantage
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600 sm:mt-4 sm:text-base">
                In the world of e-commerce, the fastest tester wins. Eliminate the friction of hiring freelancers or managing complex briefs. Scale your creative testing at 10x the speed, allowing you to find winning ads and iterate on your winners before the competition even wakes up.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-20 sm:py-24">
        <div className="text-slate-900">
          <PricingSection />
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
          Clonestatic · Payments powered by Whop
        </div>
      </footer>
    </main>
  );
}
