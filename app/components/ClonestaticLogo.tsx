'use client';

/** Clonestatic logo: two overlapping square outlines + wordmark. */
export function ClonestaticLogo({
  variant = 'dark',
  className = '',
}: {
  variant?: 'dark' | 'light';
  className?: string;
}) {
  const isLight = variant === 'light';
  const stroke = isLight ? 'currentColor' : '#1e3a5f';
  const textClass = isLight ? 'text-sky-400' : 'text-[#1e3a5f]';

  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${textClass} ${className}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden
      >
        {/* Larger square (behind, right) */}
        <rect x="8" y="4" width="16" height="16" stroke={stroke} strokeWidth="2" fill="none" rx="1" />
        {/* Smaller square (front, left) */}
        <rect x="4" y="8" width="12" height="12" stroke={stroke} strokeWidth="2" fill="none" rx="1" />
      </svg>
      <span className="text-lg">Clonestatic</span>
    </span>
  );
}
