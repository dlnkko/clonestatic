'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { LandingPricing } from './LandingPricing';
import { MaterialIcon } from './MaterialIcon';
import { Reveal } from './Reveal';

const LOGIN_APP = '/login?next=/app';
const LOGIN = '/login';

const NAV = [
  { label: 'Platform', href: '#platform' },
  { label: 'Process', href: '#process' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Showcase', href: '#showcase' },
] as const;

const STEPS = [
  {
    n: '01',
    title: 'Discover',
    body: 'Filter by category, brand, and impressions in the Meta Ad Library to find winning references instantly.',
  },
  {
    n: '02',
    title: 'Deconstruct',
    body: 'We extract visual hierarchy, copy structure, and CTA placement — then adapt it to your product catalog.',
  },
  {
    n: '03',
    title: 'Deploy',
    body: 'Generate HD statics in under a minute. Download and launch while competitors are still in revision.',
  },
] as const;

const TOOLS = [
  {
    icon: 'tune',
    title: 'Meta Ad Library',
    body: 'Browse thousands of statics sorted by impressions and refreshed monthly. Find what brands are actually spending on.',
  },
  {
    icon: 'inventory_2',
    title: 'Product sync',
    body: 'Save your product once. We pull packaging, benefits, pricing, and brand colors from your store into every ad.',
  },
  {
    icon: 'history',
    title: 'Creative history',
    body: 'Every generation saved. Revisit, refine, and iterate without rebuilding from scratch.',
  },
  {
    icon: 'download',
    title: 'HD export',
    body: 'Download publication-ready statics in seconds. No watermarks on paid plans.',
  },
] as const;

const CATEGORIES = [
  { name: 'Beauty & skincare', count: '2,450+' },
  { name: 'Supplements & wellness', count: '1,820+' },
  { name: 'Fitness & sports', count: '3,100+' },
  { name: 'Sleep & recovery', count: '940+' },
  { name: 'Food & beverage', count: '1,150+' },
] as const;

const btnPrimary =
  'inline-flex items-center justify-center rounded bg-primary px-6 py-3 font-mono text-label-caps uppercase tracking-wider text-on-primary transition-all duration-300 hover:bg-surface-tint active:scale-[0.97]';
const btnPrimaryLg = `${btnPrimary} px-8 py-4`;
const btnGhost =
  'hover-underline-anim inline-flex items-center justify-center px-6 py-3 font-mono text-label-caps uppercase tracking-wider text-primary transition-colors';

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, [menuOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <div className="landing-editorial min-h-screen overflow-x-hidden bg-surface font-sans text-on-surface antialiased selection:bg-secondary-container selection:text-on-secondary-fixed">
      <nav className="sticky top-0 z-50 mx-auto flex h-20 w-full max-w-7xl items-center justify-between border-b border-outline-variant bg-surface/95 px-gutter backdrop-blur-sm">
        <Link
          href="/"
          className="text-headline-md font-extrabold tracking-tight text-primary transition-colors hover:text-on-surface-variant"
        >
          Admirror
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover-underline-anim pb-1 font-mono text-label-caps uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={LOGIN}
            className="font-mono text-label-caps uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary md:hidden"
          >
            Log in
          </Link>

          <Link
            href={LOGIN}
            className="hover-underline-anim hidden pb-0.5 font-mono text-label-caps uppercase tracking-widest text-on-surface-variant transition-colors hover:text-primary md:inline-block"
          >
            Log in
          </Link>

          <Link href={LOGIN_APP} className={cn(btnPrimary, 'hidden md:inline-flex')}>
            Get started
          </Link>

          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded p-1 text-primary transition-transform active:scale-95 md:hidden"
          >
            <MaterialIcon name={menuOpen ? 'close' : 'menu'} className="text-3xl" />
          </button>
        </div>
      </nav>

      <div
        className={cn(
          'landing-editorial-mobile-nav border-b border-outline-variant bg-surface md:hidden',
          menuOpen && 'landing-editorial-mobile-nav-open'
        )}
      >
        <div className="flex flex-col gap-1 px-gutter py-4">
          {NAV.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-3 font-mono text-label-caps uppercase tracking-widest text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              {link.label}
            </a>
          ))}
          <Link
            href={LOGIN}
            onClick={() => setMenuOpen(false)}
            className="rounded-lg px-3 py-3 font-mono text-label-caps uppercase tracking-widest text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            Log in
          </Link>
          <Link
            href={LOGIN_APP}
            onClick={() => setMenuOpen(false)}
            className={cn(btnPrimary, 'mt-2 w-full text-center')}
          >
            Get started
          </Link>
        </div>
      </div>

      <main>
        <section className="mx-auto max-w-7xl border-b border-outline-variant px-gutter py-section-v-padding-lg">
          <div className="grid grid-cols-1 items-center gap-gutter lg:grid-cols-12">
            <Reveal className="space-y-6 lg:col-span-7" direction="up">
              <p className="flex items-center gap-2 font-mono text-eyebrow uppercase tracking-widest text-on-surface-variant">
                <span className="inline-block h-2 w-2 rounded-full bg-accent-gold" />
                Meta Ad Library · Refreshed monthly
              </p>
              <h1
                className="font-black tracking-tighter text-primary"
                style={{ fontSize: 'clamp(3rem, 6vw, 4.5rem)', lineHeight: 1.05, letterSpacing: '-0.04em' }}
              >
                Clone winning ads in 60 seconds.
              </h1>
              <p className="max-w-xl text-body-lg text-on-surface-variant">
                Stop guessing what works. Mirror proven static ads from Meta with your product, copy, and brand
                colors — same layout, new brand, ready to publish.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <Link href={LOGIN_APP} className={btnPrimaryLg}>
                  Start cloning
                </Link>
                <a href="#showcase" className={btnGhost}>
                  View library
                </a>
              </div>
            </Reveal>

            <Reveal className="relative mt-12 lg:col-span-5 lg:mt-0" direction="down" delayMs={120}>
              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="border-b border-outline-variant pb-2 font-mono text-eyebrow uppercase tracking-[0.2em] text-on-surface-variant">
                      Reference
                    </div>
                    <div className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-surface-variant">
                      <Image
                        src="/landing/hero-reference.png"
                        alt="Reference static ad"
                        fill
                        className="object-cover opacity-90 transition-opacity duration-500 group-hover:opacity-100"
                        sizes="(max-width: 1024px) 40vw, 220px"
                        priority
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <MaterialIcon name="search" className="text-4xl text-white" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between border-b border-primary pb-2 font-mono text-eyebrow uppercase tracking-[0.2em] text-primary">
                      <span>Your ad</span>
                      <MaterialIcon name="auto_awesome" className="text-sm" />
                    </div>
                    <div className="relative aspect-[4/5] overflow-hidden rounded-lg border-2 border-dashed border-accent-gold bg-surface-container-highest">
                      <Image
                        src="/landing/hero-generated.png"
                        alt="Generated static ad with your product"
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 40vw, 220px"
                        priority
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section
          id="platform"
          className="mx-auto max-w-7xl border-b border-outline-variant px-gutter py-20 md:py-section-v-padding-md"
        >
          <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
            <Reveal className="md:col-span-7 md:pr-12" direction="up">
              <h2
                className="font-extrabold tracking-tight text-primary"
                style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.1 }}
              >
                You know what works. Now you can replicate it.
              </h2>
            </Reveal>
            <Reveal className="space-y-6 pt-2 md:col-span-5" direction="down" delayMs={80}>
              <div className="border-b border-outline-variant pb-6">
                <p className="text-body-lg text-on-surface-variant">
                  The secret to scaling isn&apos;t reinventing the wheel. It&apos;s executing proven frameworks with
                  your unique brand voice. We catalog the exact structures driving millions in ad spend.
                </p>
              </div>
              <div className="border-b border-outline-variant pb-6">
                <p className="text-body-lg text-on-surface-variant">
                  Mirror layout, hooks, and typography from winners — then swap in your product catalog, store copy,
                  and brand colors in seconds, not days.
                </p>
              </div>
              <div>
                <a
                  href="#process"
                  className="hover-underline-anim inline-flex items-center gap-2 font-mono text-label-caps uppercase tracking-widest text-primary"
                >
                  See the process
                  <MaterialIcon name="arrow_forward" className="text-sm" />
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        <section
          id="process"
          className="mx-auto my-12 max-w-7xl rounded-xl border border-outline-variant bg-surface-container-low px-gutter py-20 md:py-section-v-padding-md"
        >
          <Reveal className="mb-16 text-center" direction="up">
            <h3 className="mb-4 text-headline-md font-extrabold text-primary">Three steps to production</h3>
            <p className="mx-auto max-w-2xl text-body-md text-on-surface-variant">
              A streamlined workflow designed for high-output creative teams.
            </p>
          </Reveal>
          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3">
            <div
              className="absolute left-[16.666%] right-[16.666%] top-12 z-0 hidden h-px border-t border-dashed border-outline-variant md:block"
              aria-hidden
            />
            {STEPS.map((step, i) => (
              <Reveal key={step.n} direction={i % 2 === 0 ? 'up' : 'down'} delayMs={i * 90}>
                <div className="relative z-10 flex h-full flex-col items-start rounded-lg border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
                  <div className="mb-6 rounded-full border border-primary/10 bg-secondary-container px-3 py-1 font-mono text-eyebrow text-on-secondary-fixed">
                    {step.n}
                  </div>
                  <h4 className="mb-3 text-xl font-extrabold text-primary">{step.title}</h4>
                  <p className="text-body-md text-on-surface-variant">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="border-y border-[#333] bg-[#141414] py-20 text-white md:py-section-v-padding-md">
          <div className="mx-auto max-w-7xl px-gutter">
            <Reveal className="mb-16" direction="up">
              <h2
                className="font-extrabold tracking-tight text-white"
                style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.1 }}
              >
                Precision tools.
              </h2>
              <p className="mt-4 max-w-xl text-body-lg text-[#888]">Built for media buyers who demand exactitude.</p>
            </Reveal>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-px md:border md:border-[#333] md:bg-[#333]">
              {TOOLS.map((tool, i) => (
                <Reveal key={tool.title} direction={i % 2 === 0 ? 'up' : 'down'} delayMs={i * 60}>
                  <div className="landing-tool-card rounded-lg border border-[#333] bg-[#141414] p-10 hover:bg-[#1a1a1a] md:rounded-none md:border-0">
                    <MaterialIcon name={tool.icon} className="mb-6 text-3xl text-accent-gold" />
                    <h3 className="mb-4 text-2xl font-extrabold text-white">{tool.title}</h3>
                    <p className="text-body-md text-[#888]">{tool.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="showcase" className="mx-auto max-w-4xl px-gutter py-20 md:py-section-v-padding-md">
          <Reveal direction="up">
            <div className="mb-12">
              <h2 className="border-b border-outline-variant pb-6 text-headline-md font-extrabold text-primary">
                Browse by category
              </h2>
            </div>
          </Reveal>
          <ul className="flex flex-col">
            {CATEGORIES.map((cat, i) => (
              <Reveal key={cat.name} direction={i % 2 === 0 ? 'up' : 'down'} delayMs={i * 50}>
                <li>
                  <Link
                    href={LOGIN_APP}
                    className="-mx-4 group flex items-center justify-between rounded-lg border-b border-outline-variant px-4 py-6 transition-colors hover:bg-surface-container-low"
                  >
                    <span className="text-xl font-extrabold text-primary transition-transform duration-300 group-hover:translate-x-2">
                      {cat.name}
                    </span>
                    <span className="font-mono text-eyebrow uppercase tracking-widest text-on-surface-variant">
                      {cat.count} ads
                    </span>
                  </Link>
                </li>
              </Reveal>
            ))}
          </ul>
          <Reveal className="mt-8 text-center" direction="up" delayMs={100}>
            <Link
              href={LOGIN_APP}
              className="hover-underline-anim inline-flex items-center gap-2 font-mono text-label-caps uppercase tracking-widest text-primary"
            >
              Explore the library
              <MaterialIcon name="arrow_forward" className="text-sm" />
            </Link>
          </Reveal>
        </section>

        <section
          id="pricing"
          className="mx-auto max-w-7xl border-t border-outline-variant px-gutter py-20 md:py-section-v-padding-md"
        >
          <Reveal className="mb-16 text-center" direction="down">
            <h2
              className="mb-4 font-extrabold tracking-tight text-primary"
              style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.1 }}
            >
              Simple, transparent pricing.
            </h2>
            <p className="text-body-lg text-on-surface-variant">No complex tiers. Get exactly what you need.</p>
          </Reveal>
          <Reveal direction="up" delayMs={80}>
            <LandingPricing />
          </Reveal>
        </section>

        <section className="border-t border-[#333] bg-[#141414] px-gutter py-section-v-padding-lg text-center text-white">
          <Reveal className="mx-auto max-w-3xl" direction="up">
            <h2
              className="mb-8 font-black tracking-tighter text-white"
              style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', lineHeight: 1.05, letterSpacing: '-0.04em' }}
            >
              Ready to clone success?
            </h2>
            <Link
              href={LOGIN_APP}
              className="inline-flex rounded-full bg-white px-10 py-5 font-mono text-label-caps font-bold uppercase tracking-wider text-[#141414] transition-all duration-300 hover:bg-surface-variant active:scale-[0.97]"
            >
              Get started now
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-[#333] bg-[#141414] px-gutter py-section-v-padding-md text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 text-center md:flex-row md:justify-between md:text-left">
          <div className="text-headline-md font-extrabold tracking-tighter">Admirror</div>
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            <Link
              href="/terms"
              className="font-mono text-label-caps uppercase tracking-widest text-white/60 transition-colors hover:text-white"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="font-mono text-label-caps uppercase tracking-widest text-white/60 transition-colors hover:text-white"
            >
              Privacy
            </Link>
            <Link
              href={LOGIN}
              className="font-mono text-label-caps uppercase tracking-widest text-white/60 transition-colors hover:text-white"
            >
              Sign in
            </Link>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            © {new Date().getFullYear()} Admirror
          </p>
        </div>
      </footer>
    </div>
  );
}
