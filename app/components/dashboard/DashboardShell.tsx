'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { AdmirrorLogo } from '@/app/components/AdmirrorLogo';
import { LOCALE_LABELS, useI18n, type Locale } from '@/lib/i18n/LocaleProvider';

export type DashboardTab =
  | 'new'
  | 'history'
  | 'support'
  | 'ad-library'
  | 'products';

const NAV: { id: DashboardTab; labelKey: string; icon: React.ReactNode }[] = [
  {
    id: 'new',
    labelKey: 'clone',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
      </svg>
    ),
  },
  {
    id: 'products',
    labelKey: 'products',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="m7.5 4.27 9 5.15" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      </svg>
    ),
  },
  {
    id: 'ad-library',
    labelKey: 'adLibrary',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    id: 'history',
    labelKey: 'history',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'support',
    labelKey: 'support',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

type Props = {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  sidebarOpen: boolean;
  onSidebarOpen: (open: boolean) => void;
  creditsRemaining: number | null;
  planName: string | null;
  productCount: number | null;
  maxProducts: number | null;
  canCancelSubscription: boolean;
  cancelAtPeriodEnd: boolean;
  onSubscriptionRefresh: () => void;
  user: { email: string; name?: string } | null;
  onUpgrade: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
};

export function DashboardShell({
  activeTab,
  onTabChange,
  sidebarOpen,
  onSidebarOpen,
  creditsRemaining,
  planName,
  productCount,
  maxProducts,
  canCancelSubscription,
  cancelAtPeriodEnd,
  onSubscriptionRefresh,
  user,
  onUpgrade,
  onSignOut,
  children,
}: Props) {
  const { locale, setLocale, t } = useI18n();
  const initial = user?.name?.charAt(0).toUpperCase() ?? user?.email?.charAt(0).toUpperCase() ?? '?';
  const [cancelling, setCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  const handleCancelSubscription = async () => {
    if (cancelAtPeriodEnd || cancelling) return;
    const confirmed = window.confirm(
      'Cancel your subscription at the end of the current billing period? You keep access and credits until then.'
    );
    if (!confirmed) return;

    setCancelling(true);
    setCancelMessage(null);
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'at_period_end' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCancelMessage(data.error ?? 'Could not cancel subscription');
        return;
      }
      setCancelMessage(data.message ?? 'Cancellation scheduled.');
      onSubscriptionRefresh();
    } catch {
      setCancelMessage('Network error. Try again or contact support.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="dash-app">
      <div className="dash-bg" aria-hidden />

      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => onSidebarOpen(true)}
          className="dash-mobile-menu-fab md:hidden"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <aside className={cn('dash-sidebar', sidebarOpen && 'dash-sidebar-open')}>
        <div className="dash-sidebar-header">
          <Link
            href="/"
            className="dash-sidebar-logo-link min-w-0 flex-1"
            onClick={() => onSidebarOpen(false)}
          >
            <AdmirrorLogo theme="dark" size="md" className="max-w-full" />
          </Link>
          <button
            type="button"
            onClick={() => onSidebarOpen(false)}
            className="dash-icon-btn shrink-0 md:hidden"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="dash-nav">
          <p className="dash-nav-label">Workspace</p>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onTabChange(item.id);
                onSidebarOpen(false);
              }}
              className={cn('dash-nav-item', activeTab === item.id && 'dash-nav-item-active')}
            >
              <span className="dash-nav-icon">{item.icon}</span>
              {t('nav', item.labelKey)}
            </button>
          ))}
        </nav>

        <div className="dash-sidebar-footer">
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-[var(--dash-muted)]">
            Language
          </label>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="dash-select mb-3 w-full text-xs"
          >
            {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
              <option key={loc} value={loc}>
                {LOCALE_LABELS[loc]}
              </option>
            ))}
          </select>

          <button type="button" onClick={onUpgrade} className="dash-btn dash-btn-primary w-full">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            {t('nav', 'upgrade')}
          </button>

          {(creditsRemaining !== null || planName) && (
            <div className="dash-credits">
              {planName && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-indigo)]">
                  {planName}
                </span>
              )}
              {creditsRemaining !== null && (
                <>
                  <span className="mt-1 block text-[11px] font-medium uppercase tracking-wider text-[var(--dash-muted)]">
                    Credits
                  </span>
                  <span className="mt-0.5 block text-2xl font-semibold tabular-nums tracking-tight text-[var(--dash-fg)]">
                    {creditsRemaining}
                  </span>
                </>
              )}
              {productCount !== null && maxProducts !== null && (
                <span className="mt-2 block text-xs text-[var(--dash-muted)]">
                  Products {productCount}/{maxProducts}
                </span>
              )}
            </div>
          )}

          {canCancelSubscription && (
            <div className="mt-2">
              {cancelAtPeriodEnd ? (
                <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                  Cancels at end of billing period
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  disabled={cancelling}
                  className="dash-btn dash-btn-ghost w-full text-xs text-[var(--dash-muted)]"
                >
                  {cancelling ? 'Cancelling…' : 'Cancel subscription'}
                </button>
              )}
              {cancelMessage && (
                <p className="mt-1.5 text-[11px] leading-snug text-[var(--dash-muted)]">{cancelMessage}</p>
              )}
            </div>
          )}

          <div className="dash-user">
            <div className="dash-user-avatar">{initial}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--dash-fg)]">{user?.name ?? 'User'}</p>
              <p className="truncate text-xs text-[var(--dash-muted)]">{user?.email ?? '—'}</p>
            </div>
          </div>

          <button type="button" onClick={onSignOut} className="dash-btn dash-btn-secondary w-full text-sm">
            {t('nav', 'signOut')}
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="dash-sidebar-overlay md:hidden"
          aria-label="Close menu"
          onClick={() => onSidebarOpen(false)}
        />
      )}

      <div className="dash-main">
        <div className="dash-main-inner" key={activeTab}>
          {children}
        </div>
      </div>
    </div>
  );
}
