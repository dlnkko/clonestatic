'use client';

import Image from 'next/image';
import { Space_Grotesk } from 'next/font/google';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { AdmirrorLogo } from './AdmirrorLogo';
import { LandingDemoVideo } from './LandingDemoVideo';
import { LandingLanguages } from './LandingLanguages';
import { LandingMarquee } from './LandingMarquee';
import { LandingPricing } from './LandingPricing';
import { Reveal } from './Reveal';

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
        <section className="relative flex min-h-[100svh] flex-col items-center justify-center px-4 pb-16 pt-20 sm:pb-24 sm:pt-16">
          <GhostWindow
            title="Reference"
            className="landing-ghost-a left-[2%] top-[8%] hidden w-[128px] rotate-[-7deg] opacity-45 lg:block xl:left-[3%] xl:w-[148px]"
          >
            <div className="overflow-hidden rounded-md opacity-90">
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
            className="landing-ghost-b right-[2%] top-[10%] hidden w-[132px] rotate-[7deg] opacity-40 lg:block xl:right-[3%] xl:w-[152px]"
          >
            <div className="overflow-hidden rounded-md opacity-90">
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
            title="Reference"
            className="landing-ghost-e left-[5%] bottom-[7%] hidden w-[128px] rotate-[-5deg] opacity-55 lg:block xl:left-[6%] xl:bottom-[8%] xl:w-[148px]"
          >
            <div className="overflow-hidden rounded-md">
              <Image
                src="/landing/hero-ref-lips.png"
                alt=""
                width={148}
                height={260}
                className="aspect-[9/14] w-full object-cover"
              />
            </div>
          </GhostWindow>
          <GhostWindow
            title="Yours · admirror"
            className="landing-ghost-f right-[5%] bottom-[6%] hidden w-[132px] rotate-[5deg] opacity-50 lg:block xl:right-[6%] xl:bottom-[7%] xl:w-[152px]"
          >
            <div className="overflow-hidden rounded-md">
              <Image
                src="/landing/hero-gen-loop.png"
                alt=""
                width={156}
                height={274}
                className="aspect-[9/14] w-full object-cover"
              />
            </div>
          </GhostWindow>

          <div className="landing-hero-enter relative z-10 w-full max-w-xl sm:max-w-2xl">
            <div className="landing-hero-window overflow-hidden rounded-2xl border border-white/[0.1] backdrop-blur-md">
              <div className="px-6 py-11 text-center sm:px-14 sm:py-16">
                <h1 className="text-[1.7rem] font-semibold leading-[1.15] tracking-tight text-[var(--landing-fg)] sm:text-4xl md:text-[2.75rem]">
                  Turn any winning static ad into yours.
                </h1>

                <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-white/55 sm:text-base">
                  Paste your product page URL, upload any winning static ad as reference, and get a
                  version built for your product in one click.
                </p>

                <a
                  href="#pricing"
                  className="landing-btn-hero mx-auto mt-10 inline-flex w-full max-w-xs items-center justify-center gap-2 sm:w-auto sm:min-w-[15rem]"
                >
                  Start cloning ads
                  <svg
                    className="landing-btn-hero-arrow h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <div className="landing-hero-enter relative z-10 mt-8 flex w-full max-w-sm items-end justify-center gap-6 px-2 lg:hidden" style={{ animationDelay: '180ms' }}>
            <div className="landing-ghost-window landing-ghost-e w-[42%] max-w-[148px] rotate-[-6deg] overflow-hidden rounded-xl opacity-80">
              <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-2 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-cyan)]/70" />
                <span className="text-[8px] font-medium tracking-wide text-white/30">Reference</span>
              </div>
              <div className="p-1.5">
                <Image
                  src="/landing/hero-ref-lips.png"
                  alt=""
                  width={148}
                  height={260}
                  className="aspect-[9/14] w-full rounded-md object-cover"
                />
              </div>
            </div>
            <div className="landing-ghost-window landing-ghost-f w-[42%] max-w-[148px] rotate-[6deg] overflow-hidden rounded-xl opacity-80">
              <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-2 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-cyan)]/70" />
                <span className="text-[8px] font-medium tracking-wide text-white/30">Yours · admirror</span>
              </div>
              <div className="p-1.5">
                <Image
                  src="/landing/hero-gen-loop.png"
                  alt=""
                  width={148}
                  height={260}
                  className="aspect-[9/14] w-full rounded-md object-cover"
                />
              </div>
            </div>
          </div>

          <a
            href="#demo"
            className="relative z-10 mt-10 flex flex-col items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35 transition-colors hover:text-white/60 lg:absolute lg:bottom-8 lg:left-1/2 lg:mt-0 lg:-translate-x-1/2"
          >
            See how it works
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        </section>

        <LandingMarquee />

        <section id="demo" className="relative px-4 py-16 sm:py-20">
          <Reveal>
            <div className="mx-auto max-w-4xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--landing-fg)] sm:text-3xl">
                See it in action
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-white/50">
                From reference ad to exported creative — one click, no prompts.
              </p>
            </div>
          </Reveal>
          <Reveal delayMs={100} className="mx-auto mt-8 max-w-4xl">
            <LandingDemoVideo />
          </Reveal>
        </section>

        <LandingLanguages />

        <section id="pricing" className="relative px-4 py-16 sm:py-20">
          <Reveal>
            <LandingPricing />
          </Reveal>
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
