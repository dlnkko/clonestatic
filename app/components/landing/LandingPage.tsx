'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { LandingPricing } from './LandingPricing';
import { MaterialIcon } from './MaterialIcon';
import { Reveal } from './Reveal';
import { AdmirrorLogo } from '../AdmirrorLogo';

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
  'inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-mono text-label-caps uppercase tracking-wider text-on-primary transition-all duration-300 hover:bg-surface-tint active:scale-[0.97]';
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
    <div className="landing-editorial relative min-h-screen overflow-x-hidden bg-[#faf8f5] font-sans text-on-surface antialiased selection:bg-[#C8B89A]/30 selection:text-primary">
      {/* Subtle Noise Texture */}
      <div 
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.015] mix-blend-multiply" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} 
      />

      <nav className="fixed left-1/2 top-4 z-50 flex h-16 w-[calc(100%-2rem)] max-w-7xl -translate-x-1/2 items-center justify-between rounded-full border border-outline-variant/30 bg-white/60 px-6 shadow-sm backdrop-blur-xl transition-all duration-300 hover:bg-white/80">
        <Link
          href="/"
          className="flex items-center gap-2 transition-colors hover:opacity-80"
        >
          <AdmirrorLogo theme="light" size="sm" />
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

          <Link href={LOGIN_APP} className={cn(btnPrimary, 'hidden md:inline-flex shadow-sm hover:shadow-md')}>
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
          'landing-editorial-mobile-nav fixed left-0 right-0 top-24 z-40 mx-4 rounded-xl border border-outline-variant/50 bg-white/90 p-2 shadow-lg backdrop-blur-xl md:hidden',
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

      <main className="relative z-10 pt-28">
        <section className="relative mx-auto max-w-7xl border-b border-outline-variant px-gutter py-section-v-padding-lg">
          {/* Subtle glow behind hero text */}
          <div className="absolute left-[10%] top-[20%] -z-10 h-[400px] w-[400px] rounded-full bg-[#C8B89A]/10 blur-[120px]" />
          
          <div className="grid grid-cols-1 items-center gap-gutter lg:grid-cols-12">
            <Reveal className="space-y-6 lg:col-span-7" direction="up">
              <p className="flex items-center gap-3 font-mono text-eyebrow uppercase tracking-[0.2em] text-on-surface-variant">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C8B89A] opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-[#C8B89A]"></span>
                </span>
                Meta Ad Library · Refreshed monthly
              </p>
              <h1
                className="font-black tracking-tighter text-primary"
                style={{ fontSize: 'clamp(3rem, 6vw, 5.5rem)', lineHeight: 1.05, letterSpacing: '-0.04em' }}
              >
                Clone winning ads in 60 seconds.
              </h1>
              <p className="max-w-xl text-body-lg text-on-surface-variant leading-relaxed">
                Stop guessing what works. Mirror proven static ads from Meta with your product, copy, and brand
                colors — same layout, new brand, ready to publish.
              </p>
              <div className="flex flex-wrap gap-4 pt-6">
                <Link href={LOGIN_APP} className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-primary px-8 py-4 font-mono text-label-caps font-bold uppercase tracking-wider text-white transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(200,184,154,0.4)] active:scale-[0.97]">
                  <span className="relative z-10">Start cloning</span>
                  <div className="absolute inset-0 -z-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] transition-transform duration-700 group-hover:translate-x-[100%]" />
                </Link>
                <a href="#showcase" className="inline-flex items-center justify-center rounded-full border border-outline-variant/50 bg-white/50 px-8 py-4 font-mono text-label-caps uppercase tracking-wider text-primary backdrop-blur-sm transition-all duration-300 hover:bg-white hover:shadow-md active:scale-[0.97]">
                  View library
                </a>
              </div>
            </Reveal>

            <Reveal className="relative mt-12 lg:col-span-5 lg:mt-0" direction="down" delayMs={120}>
              <div className="absolute -left-4 -top-4 select-none font-mono text-[10px] text-outline opacity-40">
                [40.7128° N, 74.0060° W]
              </div>
              <div className="absolute -bottom-4 -right-4 select-none font-mono text-[10px] text-outline opacity-40">
                REF_ID: 882-019
              </div>
              <div className="rounded-2xl border border-outline-variant/60 bg-white/40 p-8 shadow-2xl backdrop-blur-md transition-transform duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="border-b border-outline-variant/50 pb-3 font-mono text-eyebrow uppercase tracking-[0.2em] text-on-surface-variant">
                      Reference
                    </div>
                    <div className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-surface-variant shadow-inner">
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
                    <div className="flex justify-between border-b border-primary/30 pb-3 font-mono text-eyebrow uppercase tracking-[0.2em] text-primary">
                      <span>Your ad</span>
                      <MaterialIcon name="auto_awesome" className="text-sm animate-pulse" />
                    </div>
                    <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-primary/20 bg-white shadow-inner flex flex-col items-center justify-center p-4 text-center transition-all duration-500 hover:border-primary/40">
                      <MaterialIcon name="add_photo_alternate" className="mb-2 text-outline text-3xl" />
                      <p className="font-mono text-eyebrow uppercase tracking-widest text-on-surface-variant">Drop Assets</p>
                      <Image
                        src="/landing/hero-generated.png"
                        alt="Generated static ad with your product"
                        fill
                        className="object-cover opacity-0 transition-opacity duration-1000"
                        sizes="(max-width: 1024px) 40vw, 220px"
                        onLoadingComplete={(img) => img.classList.remove('opacity-0')}
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
          className="relative mx-auto max-w-7xl border-b border-outline-variant/30 px-gutter py-24 md:py-32"
        >
          {/* Decorative element */}
          <div className="absolute right-[10%] top-[30%] -z-10 h-[300px] w-[300px] rounded-full bg-[#C8B89A]/10 blur-[100px]" />
          
          <div className="grid grid-cols-1 gap-gutter md:grid-cols-12">
            <Reveal className="md:col-span-7 md:pr-12" direction="up">
              <h2
                className="font-extrabold tracking-tight text-primary"
                style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1.1 }}
              >
                You know what works. Now you can replicate it.
              </h2>
            </Reveal>
            <Reveal className="space-y-8 pt-4 md:col-span-5" direction="down" delayMs={80}>
              <div className="border-b border-outline-variant/30 pb-8">
                <p className="text-body-lg text-on-surface-variant leading-relaxed">
                  The secret to scaling isn&apos;t reinventing the wheel. It&apos;s executing proven frameworks with
                  your unique brand voice. We catalog the exact structures driving millions in ad spend.
                </p>
              </div>
              <div className="border-b border-outline-variant/30 pb-8">
                <p className="text-body-lg text-on-surface-variant leading-relaxed">
                  Mirror layout, hooks, and typography from winners — then swap in your product catalog, store copy,
                  and brand colors in seconds, not days.
                </p>
              </div>
              <div>
                <a
                  href="#process"
                  className="group inline-flex items-center gap-3 font-mono text-label-caps uppercase tracking-widest text-primary transition-colors hover:text-[#C8B89A]"
                >
                  See the process
                  <MaterialIcon name="arrow_forward" className="text-sm transition-transform duration-300 group-hover:translate-x-2" />
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        <section
          id="process"
          className="relative mx-auto my-24 max-w-7xl px-gutter py-24 md:py-32"
        >
          {/* Background subtle card */}
          <div className="absolute inset-0 -z-10 mx-4 rounded-3xl bg-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl border border-white/60" />
          
          <Reveal className="mb-20 text-center" direction="up">
            <h3 className="mb-6 text-headline-md font-extrabold text-primary" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>Three steps to production</h3>
            <p className="mx-auto max-w-2xl text-body-lg text-on-surface-variant">
              A streamlined workflow designed for high-output creative teams.
            </p>
          </Reveal>
          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3 px-4 md:px-8 pb-8">
            <div
              className="absolute left-[16.666%] right-[16.666%] top-12 z-0 hidden h-px border-t-2 border-dashed border-[#C8B89A]/30 md:block"
              aria-hidden
            />
            {STEPS.map((step, i) => (
              <Reveal key={step.n} direction={i % 2 === 0 ? 'up' : 'down'} delayMs={i * 90}>
                <div className="group relative z-10 flex h-full flex-col items-start rounded-xl border border-outline-variant/60 bg-white/50 p-8 shadow-sm backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-lg">
                  <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-b from-white/80 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="mb-6 rounded-full border border-[#C8B89A]/30 bg-[#C8B89A]/10 px-3 py-1 font-mono text-eyebrow text-primary transition-colors duration-500 group-hover:bg-[#C8B89A] group-hover:text-white">
                    {step.n}
                  </div>
                  <h4 className="mb-3 text-xl font-extrabold text-primary">{step.title}</h4>
                  <p className="text-body-md text-on-surface-variant leading-relaxed">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="relative border-y border-[#222] bg-[#0a0a0a] py-24 text-white md:py-32 overflow-hidden">
          {/* Subtle dark mode background glow */}
          <div className="absolute top-0 right-0 -z-10 h-[500px] w-[500px] rounded-full bg-[#C8B89A]/5 blur-[150px]" />
          
          <div className="mx-auto max-w-7xl px-gutter">
            <Reveal className="mb-16" direction="up">
              <h2
                className="font-extrabold tracking-tight text-white"
                style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 1.1 }}
              >
                Precision tools.
              </h2>
              <p className="mt-4 max-w-xl text-body-lg text-white/60">Built for media buyers who demand exactitude.</p>
            </Reveal>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-px md:border md:border-[#222] md:bg-[#222] rounded-2xl overflow-hidden shadow-2xl">
              {TOOLS.map((tool, i) => (
                <Reveal key={tool.title} direction={i % 2 === 0 ? 'up' : 'down'} delayMs={i * 60}>
                  <div className="group relative h-full rounded-2xl border border-[#222] bg-[#0f0f0f] p-10 transition-all duration-500 hover:bg-[#141414] md:rounded-none md:border-0">
                    <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#C8B89A]/0 via-transparent to-[#C8B89A]/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    <MaterialIcon name={tool.icon} className="mb-6 text-3xl text-[#C8B89A] transition-transform duration-500 group-hover:scale-110 group-hover:text-white" />
                    <h3 className="mb-4 text-2xl font-extrabold text-white">{tool.title}</h3>
                    <p className="text-body-md text-white/50 leading-relaxed">{tool.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="showcase" className="mx-auto max-w-4xl px-gutter py-24 md:py-32">
          <Reveal direction="up">
            <div className="mb-12">
              <h2 className="border-b border-outline-variant/50 pb-6 text-headline-md font-extrabold text-primary">
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
                    className="group flex items-center justify-between border-b border-outline-variant/30 py-6 transition-all duration-500 hover:border-primary/30 hover:bg-white/60 hover:px-6 rounded-xl -mx-6 px-6 hover:shadow-sm"
                  >
                    <span className="text-xl font-medium text-primary transition-all duration-500 group-hover:font-bold group-hover:translate-x-2">
                      {cat.name}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-eyebrow uppercase tracking-widest text-on-surface-variant transition-colors duration-500 group-hover:text-primary">
                        {cat.count} ads
                      </span>
                      <MaterialIcon 
                        name="arrow_forward" 
                        className="text-primary opacity-0 -translate-x-4 transition-all duration-500 group-hover:opacity-100 group-hover:translate-x-0" 
                      />
                    </div>
                  </Link>
                </li>
              </Reveal>
            ))}
          </ul>
          <Reveal className="mt-12 text-center" direction="up" delayMs={100}>
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
          className="relative mx-auto max-w-7xl border-t border-outline-variant/30 px-gutter py-24 md:py-32"
        >
          {/* Subtle glow behind pricing */}
          <div className="absolute left-[50%] top-[10%] -z-10 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#C8B89A]/5 blur-[120px]" />
          
          <Reveal className="mb-16 text-center" direction="down">
            <h2
              className="mb-4 font-extrabold tracking-tight text-primary"
              style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 1.1 }}
            >
              Simple, transparent pricing.
            </h2>
            <p className="text-body-lg text-on-surface-variant">No complex tiers. Get exactly what you need.</p>
          </Reveal>
          <Reveal direction="up" delayMs={80}>
            <LandingPricing />
          </Reveal>
        </section>

        <section className="relative overflow-hidden border-t border-[#222] bg-[#0a0a0a] px-gutter py-32 text-center text-white">
          <div className="absolute inset-0 z-0">
            <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#C8B89A]/10 blur-[150px]" />
            <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
          </div>
          
          <Reveal className="relative z-10 mx-auto max-w-3xl" direction="up">
            <h2
              className="mb-8 font-black tracking-tighter text-white"
              style={{ fontSize: 'clamp(3rem, 6vw, 5rem)', lineHeight: 1.05, letterSpacing: '-0.04em' }}
            >
              Ready to clone success?
            </h2>
            <Link
              href={LOGIN_APP}
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-white px-10 py-5 font-mono text-label-caps font-bold uppercase tracking-wider text-[#141414] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] active:scale-[0.97]"
            >
              <span className="relative z-10">Get started now</span>
              <div className="absolute inset-0 -z-0 bg-gradient-to-r from-transparent via-white/50 to-transparent translate-x-[-100%] transition-transform duration-700 group-hover:translate-x-[100%]" />
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-[#222] bg-[#0a0a0a] px-gutter py-12 text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 text-center md:flex-row md:justify-between md:text-left">
          <div className="flex items-center gap-3">
            <AdmirrorLogo theme="dark" size="sm" />
          </div>
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            <Link
              href="/terms"
              className="font-mono text-label-caps uppercase tracking-widest text-white/40 transition-colors hover:text-white"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="font-mono text-label-caps uppercase tracking-widest text-white/40 transition-colors hover:text-white"
            >
              Privacy
            </Link>
            <Link
              href={LOGIN}
              className="font-mono text-label-caps uppercase tracking-widest text-white/40 transition-colors hover:text-white"
            >
              Sign in
            </Link>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/20">
            © {new Date().getFullYear()} Admirror
          </p>
        </div>
      </footer>
    </div>
  );
}
