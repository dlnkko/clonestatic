'use client';

import { cn } from '@/lib/cn';
import { useReveal, type RevealDirection } from './useReveal';

export function Reveal({
  children,
  className,
  delayMs = 0,
  direction = 'up',
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  direction?: RevealDirection;
}) {
  const { ref, visible } = useReveal<HTMLDivElement>(direction);

  return (
    <div
      ref={ref}
      className={cn(
        'landing-reveal',
        direction === 'up' ? 'landing-reveal-from-up' : 'landing-reveal-from-down',
        visible && 'is-visible',
        className
      )}
      style={{ transitionDelay: visible ? `${delayMs}ms` : undefined }}
    >
      {children}
    </div>
  );
}
