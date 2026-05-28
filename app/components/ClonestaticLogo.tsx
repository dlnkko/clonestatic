import { AdmirrorLogo } from './landing/AdmirrorLogo';

/** @deprecated Use AdmirrorLogo — kept for dashboard/login imports */
export function ClonestaticLogo({
  size = 'md',
  className = '',
  variant,
}: {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const theme = variant === 'dark' ? 'dark' : 'light';
  return <AdmirrorLogo theme={theme} size={size} className={className} />;
}
