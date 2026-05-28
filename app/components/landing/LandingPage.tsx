'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { AdmirrorLogo } from './AdmirrorLogo';
import { LandingPricing } from './LandingPricing';
import { Reveal } from './Reveal';
import { useScrollParallax } from './useScrollParallax';

const NAV = [
  { label: 'Features', href: '#features' },
  { label: 'Library', href: '#library' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
];

const FEATURES = [
  {
    title: 'Clone winning statics',
    body: 'Upload any high-performing reference plus your product shots. Our pipeline deconstructs layout, hierarchy, and hooks—then rebuilds for your brand.',
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
    title: 'Product URL scraping',
    body: 'Paste your PDP—we extract real features, benefits, and offers for copy that matches your product, not generic AI fluff.',
    gradient: 'from-violet-400 to-purple-600',
    span: '',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    ),
  },
  {
    title: 'Edit & iterate',
    body: 'Tweak headlines, swap visuals, or refine with natural-language edits—without restarting from zero.',
    gradient: 'from-fuchsia-400 to-pink-600',
    span: '',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    ),
  },
  {
    title: 'Global Ad Library',
    body: 'Browse US meme statics by category and brand, sorted by impressions. Clone what’s already spending—not what you guess might work.',
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
    title: 'Pick a reference',
    text: 'Upload a file or pick from the Ad Library—filter by niche, brand, and impressions.',
  },
  {
    n: '02',
    title: 'Add your product',
    text: 'Images plus optional store URL. We match layout and write copy from your real PDP data.',
  },
  {
    n: '03',
    title: 'Generate & export',
    text: 'Download, edit, or clone again. Ship more variants before competitors catch up.',
  },
];

const STATS = [
  { value: '<5 min', label: 'Reference to export' },
  { value: '10×', label: 'Faster creative tests' },
  { value: 'US', label: 'Meta meme library' },
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
    <div className="landing-root min-h-screen overflow-x-hidden bg-[#060a14] text-white">
      <div className="landing-orb landing-orb-a landing-parallax-fast" aria-hidden />
      <div className="landing-orb landing-orb-b landing-parallax-mid" aria-hidden />
      <div className="landing-orb landing-orb-c landing-parallax-slow" aria-hidden />
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
              Log in
            </a>
            <a href="/app" className="landing-btn-primary hidden sm:inline-flex">
              Get started
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
              <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-medium hover:bg-white/10">
                {link.label}
              </a>
            ))}
            <a href="/app" onClick={() => setMenuOpen(false)} className="landing-btn-primary mx-2 mb-2 mt-1 justify-center">
              Get started
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative px-4 pb-16 pt-28 sm:pb-24 sm:pt-36 md:pt-40">
          <div className="mx-auto max-w-4xl text-center">
            <Reveal direction="down">
              <p className="landing-pill mx-auto">Static ads · US Ad Library · AI clone</p>
            </Reveal>
            <Reveal direction="up" delayMs={80}>
              <h1 className="mt-8 text-[2rem] font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
                Mirror what&apos;s{' '}
                <span className="landing-gradient-text">already winning</span>
                <br className="hidden sm:block" />
                {' '}— then make it yours
              </h1>
            </Reveal>
            <Reveal direction="down" delayMs={160}>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
                admirror turns top-performing static ads into ready-to-publish creatives for your product.
                Reference, scrape, generate—in minutes.
              </p>
            </Reveal>
            <Reveal direction="up" delayMs={240}>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                <a href="/app" className="landing-btn-primary w-full sm:w-auto">
                  Start free
                </a>
                <a href="#features" className="landing-btn-ghost w-full sm:w-auto">
                  Explore features
                </a>
              </div>
            </Reveal>
          </div>

          <Reveal direction="up" delayMs={320} className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-4 sm:gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="landing-stat-pill text-center">
                <p className="text-2xl font-bold landing-gradient-text sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-xs text-white/50 sm:text-sm">{s.label}</p>
              </div>
            ))}
          </Reveal>

          <Reveal direction="down" delayMs={400} className="mx-auto mt-16 max-w-5xl">
            <div className="landing-hero-mock relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-1 sm:rounded-3xl">
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-950/80 p-3 sm:grid-cols-5 sm:gap-2 sm:p-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="landing-mock-card aspect-[9/16] rounded-lg bg-gradient-to-b from-cyan-500/20 to-indigo-600/10 ring-1 ring-white/10"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          </Reveal>

          <div className="landing-scroll-hint mx-auto mt-12 flex flex-col items-center gap-2 text-white/40">
            <span className="text-xs uppercase tracking-widest">Scroll</span>
            <div className="landing-scroll-chevron" aria-hidden />
          </div>
        </section>

        {/* Features — bento */}
        <section id="features" className="landing-section-light relative px-4 py-20 sm:py-28">
          <div className="landing-parallax-blob landing-parallax-blob-a" aria-hidden />
          <div className="mx-auto max-w-6xl">
            <Reveal direction="down" className="text-center">
              <p className="landing-section-label landing-section-label-dark mx-auto">Features</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
                Built for performance marketers
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-slate-600 sm:text-lg">
                Everything you need to go from swipe-file inspiration to live ads—without an agency retainer.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-4 md:grid-cols-2 md:gap-5">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} direction={i % 2 === 0 ? 'up' : 'down'} delayMs={i * 70}>
                  <article
                    className={cn(
                      'landing-feature-card group h-full p-8 sm:p-9',
                      f.span
                    )}
                  >
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
                    <h3 className="mt-6 text-xl font-bold text-slate-900 sm:text-2xl">{f.title}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-slate-600 sm:text-base">{f.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Library band */}
        <section id="library" className="relative overflow-hidden px-4 py-20 sm:py-28">
          <div className="landing-library-band mx-auto max-w-6xl rounded-[2rem] px-6 py-14 sm:px-12 sm:py-16">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <Reveal direction="up">
                <p className="landing-section-label">Ad Library</p>
                <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
                  Thousands of proven US statics—sorted by impressions
                </h2>
                <p className="mt-4 text-white/70 leading-relaxed">
                  Browse by category or brand. See what&apos;s actually spending in supplements, beauty, fitness, and more.
                  One click to use any ad as your clone reference.
                </p>
                <a href="/app" className="landing-btn-primary mt-8 inline-flex">
                  Browse library
                </a>
              </Reveal>
              <Reveal direction="down" delayMs={120}>
                <div className="grid grid-cols-2 gap-3">
                  {['beauty', 'supplements', 'fitness', 'sleep'].map((cat, i) => (
                    <div
                      key={cat}
                      className="landing-library-tile rounded-2xl p-4 capitalize"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      <span className="text-xs font-medium uppercase tracking-wider text-cyan-300/80">Category</span>
                      <p className="mt-2 text-lg font-semibold">{cat}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="landing-section-light px-4 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <Reveal direction="down" className="text-center">
              <p className="landing-section-label landing-section-label-dark mx-auto">How it works</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Three steps to ship</h2>
            </Reveal>
            <ol className="relative mt-16 grid gap-8 md:grid-cols-3 md:gap-6">
              <div className="landing-steps-line hidden md:block" aria-hidden />
              {STEPS.map((step, i) => (
                <Reveal key={step.n} direction={i === 1 ? 'down' : 'up'} delayMs={i * 100}>
                  <li className="landing-step-card relative rounded-3xl p-8 text-center md:text-left">
                    <span className="landing-step-num">{step.n}</span>
                    <h3 className="mt-6 text-lg font-bold text-slate-900">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
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
            <div className="landing-cta-glow mx-auto max-w-3xl rounded-[2rem] px-6 py-14 text-center sm:px-12 sm:py-16">
              <AdmirrorLogo theme="light" size="lg" className="mx-auto justify-center" />
              <h2 className="mt-8 text-2xl font-bold sm:text-4xl">Ready to ship your next winner?</h2>
              <p className="mx-auto mt-4 max-w-md text-white/65">
                Start with a free generation. Upgrade when you&apos;re ready to scale creative testing.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a href="/app" className="landing-btn-primary">
                  Open app
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
                <a key={l.href} href={l.href} className="hover:text-white/80 transition-colors">
                  {l.label}
                </a>
              ))}
            </nav>
            <p className="text-sm text-white/40">© {new Date().getFullYear()} admirror</p>
          </div>
        </Reveal>
      </footer>
    </div>
  );
}
