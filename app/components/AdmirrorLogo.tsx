import { cn } from '@/lib/cn';

const SIZES = {
  sm: { h: 28, icon: 22, text: 15 },
  md: { h: 36, icon: 28, text: 18 },
  lg: { h: 44, icon: 34, text: 22 },
} as const;

/**
 * Vector admirror logo — two mirrored ad frames + play arrow.
 * theme="dark" for light backgrounds (dashboard); theme="light" for dark hero/login.
 */
export function AdmirrorLogo({
  theme = 'dark',
  size = 'md',
  className,
}: {
  theme?: 'dark' | 'light';
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  const text = theme === 'light' ? '#f8fafc' : '#0f1b3d';
  const accent = theme === 'light' ? '#22d3ee' : '#6366f1';
  const accent2 = theme === 'light' ? '#a78bfa' : '#38bdf8';

  return (
    <span
      className={cn('inline-flex items-center gap-2.5 select-none', className)}
      role="img"
      aria-label="admirror"
    >
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden
      >
        <rect
          x="4"
          y="6"
          width="14"
          height="18"
          rx="2"
          stroke={accent}
          strokeWidth="1.75"
          className="opacity-90"
        />
        <rect
          x="10"
          y="4"
          width="14"
          height="18"
          rx="2"
          stroke={accent2}
          strokeWidth="1.75"
        />
        <path d="M22 14l6 4-6 4v-8z" fill={accent} />
      </svg>
      <span
        className="font-semibold tracking-tight leading-none"
        style={{ fontSize: s.text, color: text }}
      >
        admirror
      </span>
    </span>
  );
}
