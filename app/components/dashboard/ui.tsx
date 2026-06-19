'use client';

import { cn } from '@/lib/cn';

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'dash-animate-in mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className="max-w-2xl">
        <h1 className="dash-title">{title}</h1>
        <div className="dash-title-accent" aria-hidden />
        {description && <p className="dash-subtitle mt-3">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function DashCard({
  children,
  className,
  padding = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'default' | 'lg';
}) {
  return (
    <div
      className={cn(
        'dash-card',
        padding === 'lg' && 'dash-card-lg',
        padding === 'none' && 'p-0',
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  badge,
}: {
  title: string;
  badge?: 'required' | 'optional';
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="dash-section-title">{title}</h2>
      {badge === 'required' && <span className="dash-badge dash-badge-required">Required</span>}
      {badge === 'optional' && <span className="dash-badge dash-badge-optional">Optional</span>}
    </div>
  );
}

export { StepHeader } from './StepHeader';

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2">
      <label className="dash-label">{children}</label>
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-[var(--dash-muted)]">{hint}</p>}
    </div>
  );
}

export function DashInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('dash-input', props.className)} />;
}

export function DashSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn('dash-input dash-select', props.className)} />;
}

export function DashTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('dash-input dash-textarea', props.className)} />;
}

export function PrimaryButton({
  children,
  className,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn('dash-btn dash-btn-primary', loading && 'dash-btn-loading', className)}
      disabled={props.disabled || loading}
    >
      {loading && <span className="dash-spinner dash-spinner-on-dark" aria-hidden />}
      <span className={cn(loading && 'opacity-80')}>{children}</span>
    </button>
  );
}

export function SecondaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className={cn('dash-btn dash-btn-secondary', className)}>
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className={cn('dash-btn dash-btn-ghost', className)}>
      {children}
    </button>
  );
}

export function PreviewPanel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('dash-preview-panel', className)}>
      <div className="dash-preview-panel-header">
        <span className="dash-preview-panel-label">{title}</span>
        {action}
      </div>
      <div className="dash-preview-panel-body">{children}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="dash-empty">
      {icon && <div className="dash-empty-icon">{icon}</div>}
      <p className="dash-empty-title">{title}</p>
      {description && <p className="dash-empty-desc">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function AlertError({ children }: { children: React.ReactNode }) {
  return <div className="dash-alert dash-alert-error">{children}</div>;
}

export function AlertInfo({ children }: { children: React.ReactNode }) {
  return <div className="dash-alert dash-alert-info">{children}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('dash-spinner', className)} aria-hidden />;
}
