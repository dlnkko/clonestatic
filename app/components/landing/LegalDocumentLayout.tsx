import Link from 'next/link';
import { AdmirrorLogo } from '@/app/components/AdmirrorLogo';

type LegalDocumentLayoutProps = {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
};

export function LegalDocumentLayout({ title, lastUpdated, children }: LegalDocumentLayoutProps) {
  return (
    <div className="landing-root min-h-screen bg-[#050810] text-white">
      <div className="landing-hero-grid" aria-hidden />

      <header className="border-b border-white/10 px-4 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60">
            <AdmirrorLogo theme="light" size="sm" />
          </Link>
          <Link href="/" className="text-sm text-white/60 transition-colors hover:text-white">
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-white/50">Last updated: {lastUpdated}</p>
        <article className="legal-prose mt-10">{children}</article>
      </main>

      <footer className="border-t border-white/10 px-4 py-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 text-sm text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} admirror</p>
          <nav className="flex flex-wrap justify-center gap-6">
            <Link href="/privacy" className="transition-colors hover:text-white/80">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white/80">
              Terms of Service
            </Link>
            <Link href="/login" className="transition-colors hover:text-white/80">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
