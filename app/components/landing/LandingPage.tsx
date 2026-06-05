'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { AdmirrorLogo } from './AdmirrorLogo';
import { LandingMarquee } from './LandingMarquee';
import { LandingPricing } from './LandingPricing';
import { Reveal } from './Reveal';
import { useScrollParallax } from './useScrollParallax';

const NAV = [
  { label: 'How it works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Meta Ad Library', href: '#library' },
  { label: 'Pricing', href: '#pricing' },
];

const FEATURES = [
  {
    title: 'Mirror what already converts',
    body: 'Upload a reference or pull one from the Meta Ad Library. We rebuild layout, hierarchy, and hooks around your product. Structure comes from winners, not generic AI output.',
    gradient: 'from-cyan-400 via-sky-500 to-indigo-600',
    span: 'md:col-span-2',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    ),
  },
  {
    title: 'Your PDP, in the creative',
    body: 'Paste your product URL. We pull benefits, pricing, and brand colors from the page. The ad reads like your store, not a template pulled from thin air.',
    gradient: 'from-violet-400 to-purple-600',
    span: '',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    ),
  },
  {
    title: 'Iterate without rebuilding',
    body: 'Tweak headlines, swap visuals, or refine with a short edit note. Same ad, faster rounds. No new brief. No starting over.',
    gradient: 'from-fuchsia-400 to-pink-600',
    span: '',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    ),
  },
  {
    title: 'Meta Ad Library, built in',
    body: 'Thousands of statics sourced from Meta, sorted by impressions and refreshed every month. Mirror what brands are spending on, not what you guess might work.',
    gradient: 'from-emerald-400 to-teal-600',
    span: 'md:col-span-2',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    ),
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Choose what\'s spending',
    text: 'Upload a reference or pick from the Meta Ad Library. Filter by niche, brand, and impressions.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
    ),
  },
  {
    n: '02',
    title: 'Add your product',
    text: 'Save product images or paste your store URL. Layout and copy adapt to your catalog, not a competitor\'s.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    ),
  },
  {
    n: '03',
    title: 'Export and launch',
    text: 'Download HD statics in under a minute. Run more tests this week while others are still in revision.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    ),
  },
];

const PROOF = [
  { value: '60s', label: 'Reference to export' },
  { value: '10×', label: 'More variants per week' },
  { value: '0', label: 'Prompts to write' },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useScrollParallax();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, [menuOpen]);

  return (
    <div className="landing-root min-h-screen overflow-x-hidden bg-[#050810] text-white">
      <div className="landing-orb landing-orb-a landing-parallax-fast" aria-hidden />
      <div className="landing-orb landing-orb-b landing-parallax-mid" aria-hidden />
      <div className="landing-orb landing-orb-c landing-parallax-slow" aria-hidden />
      <div className="landing-hero-grid" aria-hidden />
      <div className="landing-scroll-line" aria-hidden />

      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-500',
          scrolled ? 'landing-header-scrolled py-2' : 'py-4'
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60">
            <AdmirrorLogo theme="light" size="md" />
          </a>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((link) => (
              <a key={link.href} href={link.href} className="landing-nav-link">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/login" className="hidden text-sm font-medium text-white/80 hover:text-white sm:inline-flex">
              Sign in
            </a>
            <a href="/login?next=/app" className="landing-btn-primary hidden sm:inline-flex">
              Try free
            </a>
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 md:hidden"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                {menuOpen ? (
                  <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
        <div className={cn('landing-mobile-nav md:hidden', menuOpen && 'landing-mobile-nav-open')}>
          <div className="mx-4 mt-2 flex flex-col rounded-2xl border border-white/10 bg-slate-900/95 p-2 backdrop-blur-xl">
            {NAV.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-medium hover:bg-white/10"
              >
                {link.label}
              </a>
            ))}
            <a href="/login?next=/app" onClick={() => setMenuOpen(false)} className="landing-btn-primary mx-2 mb-2 mt-1 justify-center">
              Try free
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative px-4 pb-8 pt-28 sm:pb-12 sm:pt-36 lg:pt-40">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="text-center lg:text-left">
              <Reveal direction="down">
                <p className="landing-pill mx-auto lg:mx-0">
                  <span className="landing-pill-dot" />
                  Meta Ad Library · Refreshed monthly
                </p>
              </Reveal>
              <Reveal direction="up" delayMs={80}>
                <h1 className="mt-6 text-[1.75rem] font-bold leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.25rem]">
                  Ship proven static ads in{' '}
                  <span className="landing-gradient-text">60 seconds</span>
                </h1>
              </Reveal>
              <Reveal direction="down" delayMs={160}>
                <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg lg:mx-0">
                  Built to scale products on Meta. Mirror what&apos;s already converting into your
                  catalog, copy, and creatives in one click.
                </p>
              </Reveal>
              <Reveal direction="up" delayMs={240}>
                <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                  <a href="/login?next=/app" className="landing-btn-primary w-full sm:w-auto">
                    Start free · 2 generations
                  </a>
                  <a href="#how" className="landing-btn-ghost w-full sm:w-auto">
                    See how it works
                  </a>
                </div>
                <p className="mt-4 text-xs text-white/45">No credit card · Cancel anytime</p>
              </Reveal>
            </div>

            <Reveal direction="up" delayMs={200} className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="landing-hero-showcase landing-hero-mock">
                <div className="landing-showcase-glow" aria-hidden />
                <div className="landing-showcase-frame">
                  <div className="landing-showcase-bar">
                    <span className="landing-showcase-dot bg-red-400/80" />
                    <span className="landing-showcase-dot bg-amber-400/80" />
                    <span className="landing-showcase-dot bg-emerald-400/80" />
                    <span className="ml-2 text-[10px] font-medium text-white/40">admirror · Mirror</span>
                  </div>
                  <div className="landing-showcase-body">
                    <div className="grid grid-cols-2 gap-2 p-3">
                      <div className="landing-showcase-card landing-showcase-card-ref col-span-1">
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-cyan-300/90">Reference</span>
                        <div className="landing-showcase-ad-image mt-2">
                          <Image
                            src="/landing/hero-reference.png"
                            alt="Reference static ad, lemme BALANCE hormonal support"
                            width={360}
                            height={640}
                            className="h-full w-full object-cover object-center"
                            priority
                            sizes="(max-width: 1024px) 40vw, 220px"
                          />
                        </div>
                      </div>
                      <div className="landing-showcase-card landing-showcase-card-out col-span-1">
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-300/90">Your ad</span>
                        <div className="landing-showcase-ad-image mt-2">
                          <Image
                            src="/landing/hero-generated.png"
                            alt="Static ad generated with admirror, Bloom creatine gummies"
                            width={360}
                            height={640}
                            className="h-full w-full object-cover object-center"
                            priority
                            sizes="(max-width: 1024px) 40vw, 220px"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 border-t border-white/5 px-3 py-2.5">
                      <span className="landing-showcase-chip">Product URL</span>
                      <span className="landing-showcase-chip">Brand colors</span>
                      <span className="landing-showcase-chip landing-showcase-chip-active">Generate</span>
                    </div>
                  </div>
                </div>
                <div className="landing-showcase-float landing-showcase-float-a">+40 credits</div>
                <div className="landing-showcase-float landing-showcase-float-b">HD export</div>
              </div>
            </Reveal>
          </div>

          <Reveal direction="up" delayMs={320} className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-3 sm:gap-6 lg:max-w-3xl">
            {PROOF.map((s) => (
              <div key={s.label} className="landing-stat-pill text-center">
                <p className="text-xl font-bold landing-gradient-text sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-[10px] text-white/50 sm:text-xs">{s.label}</p>
              </div>
            ))}
          </Reveal>
        </section>

        <LandingMarquee />

        {/* Tagline band */}
        <section className="relative px-4 py-16 sm:py-20">
          <Reveal direction="up" className="mx-auto max-w-4xl text-center">
            <h2 className="text-2xl font-bold leading-snug sm:text-4xl md:text-[2.5rem]">
              The exact layout that converted.{' '}
              <span className="landing-gradient-text">Built around your product.</span>
            </h2>
          </Reveal>
        </section>

        {/* Pain / story */}
        <section className="landing-pain-section relative px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <Reveal direction="up">
              <p className="landing-section-label">The production gap</p>
              <h2 className="mt-4 text-2xl font-bold leading-tight sm:text-4xl">
                You know what works. You just can&apos;t ship it fast enough.
              </h2>
            </Reveal>
            <Reveal direction="down" delayMs={100} className="mt-8 space-y-5 text-base leading-relaxed text-white/70 sm:text-lg">
              <p>
                You pull references from Meta Ad Library. Screenshot. Brief a designer. Wait.
                First draft misses the hook. Revisions eat the week.
              </p>
              <p>
                By launch day the trend moved. A sharper team had already tested a dozen angles
                on the same concept.
              </p>
              <p className="text-white/90">
                <strong className="font-semibold text-white">Strategy wasn&apos;t the bottleneck. Production was.</strong>{' '}
                admirror mirrors proven layouts with your product, brand, and store copy in minutes,
                not sprints.
              </p>
            </Reveal>
            <Reveal direction="up" delayMs={180}>
              <a href="/login?next=/app" className="landing-btn-primary mt-10 inline-flex">
                Start mirroring free
              </a>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="landing-section-light relative px-4 py-20 sm:py-28">
          <div className="landing-parallax-blob landing-parallax-blob-a" aria-hidden />
          <div className="mx-auto max-w-6xl">
            <Reveal direction="down" className="text-center">
              <p className="landing-section-label landing-section-label-dark mx-auto">How it works</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
                Reference to export in three steps
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-slate-600 sm:text-lg">
                No prompt docs. No agency retainer. Proven structure, your catalog.
              </p>
            </Reveal>

            <ol className="relative mt-14 grid gap-6 md:grid-cols-3 md:gap-8">
              <div className="landing-steps-line hidden md:block" aria-hidden />
              {STEPS.map((step, i) => (
                <Reveal key={step.n} direction={i === 1 ? 'down' : 'up'} delayMs={i * 100}>
                  <li className="landing-step-card-v2 group relative h-full rounded-3xl p-8">
                    <span className="landing-step-icon">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                        {step.icon}
                      </svg>
                    </span>
                    <span className="landing-step-num mt-6 block">{step.n}</span>
                    <h3 className="mt-3 text-lg font-bold text-slate-900">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="relative px-4 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <Reveal direction="down" className="text-center">
              <p className="landing-section-label mx-auto">Features</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Everything a performance team expects
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-white/65 sm:text-lg">
                The creative ops stack, without the ops. Ship more statics before the account goes stale.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-4 md:grid-cols-2 md:gap-5">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} direction={i % 2 === 0 ? 'up' : 'down'} delayMs={i * 70}>
                  <article className={cn('landing-feature-card-v2 group h-full p-8 sm:p-9', f.span)}>
                    <span
                      className={cn(
                        'flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg transition-transform duration-500 group-hover:scale-110',
                        f.gradient
                      )}
                    >
                      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                        {f.icon}
                      </svg>
                    </span>
                    <h3 className="mt-6 text-xl font-bold sm:text-2xl">{f.title}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-white/65 sm:text-base">{f.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Library */}
        <section id="library" className="landing-section-light relative px-4 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="landing-library-band-v2 overflow-hidden rounded-[2rem] px-6 py-14 sm:px-12 sm:py-16">
              <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
                <Reveal direction="up">
                  <p className="landing-section-label landing-section-label-dark">Meta Ad Library</p>
                  <h2 className="mt-3 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
                    What&apos;s spending on Meta, curated and sorted for you
                  </h2>
                  <p className="mt-4 leading-relaxed text-slate-600">
                    Browse statics by category and brand, ranked by impressions. Pick a reference,
                    mirror it with your product and store copy. The library refreshes every month, so
                    you always work from current winners, not last quarter&apos;s archive.
                  </p>
                  <a href="/login?next=/app" className="landing-btn-primary mt-8 inline-flex !text-white">
                    Explore Meta Ad Library
                  </a>
                </Reveal>
                <Reveal direction="down" delayMs={120}>
                  <div className="grid grid-cols-2 gap-3">
                    {['Beauty', 'Supplements', 'Fitness', 'Sleep'].map((cat, i) => (
                      <div
                        key={cat}
                        className="landing-library-tile-v2 rounded-2xl p-5"
                        style={{ animationDelay: `${i * 100}ms` }}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Category</span>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{cat}</p>
                        <div className="mt-3 flex gap-1">
                          {[1, 2, 3].map((j) => (
                            <div
                              key={j}
                              className="h-8 flex-1 rounded-md bg-gradient-to-b from-indigo-100 to-cyan-50 ring-1 ring-slate-200/80"
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="landing-section-pricing relative px-4 py-20 sm:py-28">
          <div className="landing-parallax-blob landing-parallax-blob-b" aria-hidden />
          <LandingPricing />
        </section>

        {/* CTA */}
        <section className="relative px-4 py-20 sm:py-28">
          <Reveal direction="up">
            <div className="landing-cta-glow-v2 mx-auto max-w-3xl rounded-[2rem] px-6 py-14 text-center sm:px-12 sm:py-16">
              <AdmirrorLogo theme="light" size="lg" className="mx-auto justify-center" />
              <h2 className="mt-8 text-2xl font-bold sm:text-4xl">
                Stop briefing from scratch.{' '}
                <span className="landing-gradient-text">Start from what converts.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-white/65">
                Every concept built from scratch is a bet. Every mirrored winner is a head start.
                admirror is the tool your stack was missing.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a href="/login?next=/app" className="landing-btn-primary">
                  Start free
                </a>
                <a href="#pricing" className="landing-btn-ghost">
                  View pricing
                </a>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/10 px-4 py-10">
        <Reveal direction="down">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
            <AdmirrorLogo theme="light" size="sm" />
            <nav className="flex flex-wrap justify-center gap-6 text-sm text-white/50">
              {NAV.map((l) => (
                <a key={l.href} href={l.href} className="transition-colors hover:text-white/80">
                  {l.label}
                </a>
              ))}
              <a href="/privacy" className="transition-colors hover:text-white/80">
                Privacy Policy
              </a>
              <a href="/terms" className="transition-colors hover:text-white/80">
                Terms of Service
              </a>
            </nav>
            <p className="text-sm text-white/40">© {new Date().getFullYear()} admirror</p>
          </div>
        </Reveal>
      </footer>
    </div>
  );
}
