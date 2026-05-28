'use client';

import { cn } from '@/lib/cn';

export type DashboardTab =
  | 'new'
  | 'history'
  | 'edit'
  | 'support'
  | 'ad-library'
  | 'products';

const NAV: { id: DashboardTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'new',
    label: 'Clone',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
      </svg>
    ),
  },
  {
    id: 'edit',
    label: 'Edit',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
      </svg>
    ),
  },
  {
    id: 'products',
    label: 'Products',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="m7.5 4.27 9 5.15" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      </svg>
    ),
  },
  {
    id: 'ad-library',
    label: 'Ad Library',
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
    label: 'History',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'support',
    label: 'Support',
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
  user,
  onUpgrade,
  onSignOut,
  children,
}: Props) {
  const initial = user?.name?.charAt(0).toUpperCase() ?? user?.email?.charAt(0).toUpperCase() ?? '?';

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
        <div className="dash-sidebar-mobile-close md:hidden">
          <button
            type="button"
            onClick={() => onSidebarOpen(false)}
            className="dash-icon-btn"
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
              {item.label}
            </button>
          ))}
        </nav>

        <div className="dash-sidebar-footer">
          <button type="button" onClick={onUpgrade} className="dash-btn dash-btn-primary w-full">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            Upgrade plan
          </button>

          {creditsRemaining !== null && (
            <div className="dash-credits">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--dash-muted)]">
                Credits
              </span>
              <span className="mt-0.5 block text-2xl font-semibold tabular-nums tracking-tight text-[var(--dash-fg)]">
                {creditsRemaining}
              </span>
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
            Sign out
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
