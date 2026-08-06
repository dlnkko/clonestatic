'use client';

import Image from 'next/image';
import { Space_Grotesk } from 'next/font/google';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { AdmirrorLogo } from './AdmirrorLogo';
import { LandingDemoVideo } from './LandingDemoVideo';
import { LandingPricing } from './LandingPricing';

const landingFont = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-landing',
});

function GhostWindow({
  className,
  title,
  children,
}: {
  className?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'landing-ghost-window pointer-events-none absolute overflow-hidden rounded-xl border border-white/[0.07] shadow-2xl backdrop-blur-[2px]',
        className
      )}
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-cyan)]/70" />
        <span className="text-[9px] font-medium tracking-wide text-white/25">{title}</span>
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

export function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={cn(
        landingFont.variable,
        landingFont.className,
        'landing-root landing-minimal min-h-screen overflow-x-hidden text-[var(--landing-fg)]'
      )}
    >
      <div className="landing-cnvs-bg" aria-hidden>
        <div className="landing-cnvs-glow" />
        <div className="landing-cnvs-stars" />
      </div>

      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-[background,border-color] duration-300',
          scrolled
            ? 'border-b border-white/[0.05] bg-[#050810]/75 backdrop-blur-xl'
            : 'border-b border-transparent'
        )}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)]/40">
            <AdmirrorLogo theme="light" size="md" />
          </a>
          <div className="flex items-center gap-6 sm:gap-8">
            <a href="#pricing" className="text-base font-medium text-white/55 transition-colors hover:text-white sm:text-lg">
              Pricing
            </a>
            <a href="/login" className="text-base font-medium text-white/55 transition-colors hover:text-white sm:text-lg">
              Sign in
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative flex min-h-[100svh] flex-col items-center justify-center px-4 pb-24 pt-20 sm:pb-28 sm:pt-16">
          <GhostWindow
            title="Reference"
            className="landing-ghost-a left-[4%] top-[18%] hidden w-[140px] rotate-[-8deg] opacity-40 lg:block xl:w-[160px]"
          >
            <div className="overflow-hidden rounded-md opacity-80">
              <Image
                src="/landing/hero-reference.png"
                alt=""
                width={160}
                height={280}
                className="aspect-[9/14] w-full object-cover"
                priority
              />
            </div>
          </GhostWindow>
          <GhostWindow
            title="Your product"
            className="landing-ghost-b right-[5%] top-[22%] hidden w-[150px] rotate-[7deg] opacity-35 lg:block xl:w-[170px]"
          >
            <div className="overflow-hidden rounded-md opacity-80">
              <Image
                src="/landing/hero-generated.png"
                alt=""
                width={170}
                height={300}
                className="aspect-[9/14] w-full object-cover"
                priority
              />
            </div>
          </GhostWindow>
          <GhostWindow
            title="Export · HD"
            className="landing-ghost-c bottom-[18%] left-[8%] hidden w-[200px] rotate-[-4deg] opacity-30 xl:block"
          >
            <div className="space-y-1.5 px-1 py-2 font-mono text-[9px] leading-relaxed text-white/25">
              <p>product_url → synced</p>
              <p>layout → mirrored</p>
              <p>export → ready</p>
            </div>
          </GhostWindow>
          <GhostWindow
            title="Clone"
            className="landing-ghost-d bottom-[20%] right-[7%] hidden w-[180px] rotate-[5deg] opacity-28 xl:block"
          >
            <div className="space-y-1.5 px-1 py-2 font-mono text-[9px] leading-relaxed text-white/25">
              <p>prompts: 0</p>
              <p>clicks: 1</p>
              <p>status: done</p>
            </div>
          </GhostWindow>

          <div className="landing-hero-window relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.1] backdrop-blur-md sm:max-w-2xl">
            <div className="px-6 py-10 text-center sm:px-12 sm:py-14">
              <h1 className="text-[1.65rem] font-semibold leading-[1.12] tracking-tight text-[var(--landing-fg)] sm:text-4xl md:text-[2.65rem]">
                Clone winning ads.
                <br />
                Ship in seconds.
              </h1>

              <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-white/55 sm:text-base">
                No prompts. Paste your product page URL, pick a reference, and clone in one click —
                we adapt everything to your product automatically.
              </p>

              <a href="#pricing" className="landing-btn-gold mx-auto mt-9 inline-flex w-full max-w-xs justify-center sm:w-auto sm:min-w-[14rem]">
                Get admirror
              </a>
            </div>
          </div>

          <a
            href="#demo"
            className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35 transition-colors hover:text-white/60"
          >
            See how it works
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        </section>

        <section id="demo" className="relative px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--landing-fg)] sm:text-3xl">
              See it in action
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/50">
              From reference ad to exported creative — one click, no prompts.
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-4xl">
            <LandingDemoVideo />
          </div>
        </section>

        <section id="pricing" className="relative px-4 py-16 sm:py-20">
          <LandingPricing />
        </section>
      </main>

      <footer className="border-t border-white/[0.06] px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-white/35 sm:flex-row">
          <AdmirrorLogo theme="light" size="sm" />
          <nav className="flex items-center gap-6">
            <a href="/privacy" className="transition-colors hover:text-white/60">
              Privacy
            </a>
            <a href="/terms" className="transition-colors hover:text-white/60">
              Terms
            </a>
            <span>© {new Date().getFullYear()} admirror</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}
