'use client';

import Image from 'next/image';
import { cn } from '@/lib/cn';

const HEIGHT = {
  sm: 'h-7',
  md: 'h-9',
  lg: 'h-11',
} as const;

export function ClonestaticLogo({
  size = 'md',
  className = '',
}: {
  /** @deprecated ignored — logo asset is always the brand image */
  variant?: 'dark' | 'light';
  size?: keyof typeof HEIGHT;
  className?: string;
}) {
  return (
    <span className={cn('dash-logo', className)}>
      <Image
        src="/logo.png"
        alt="admirror"
        width={200}
        height={56}
        priority
        className={cn(HEIGHT[size], 'w-auto max-w-[10rem] object-contain object-left')}
        onError={(e) => {
          const img = e.currentTarget;
          if (!img.dataset.fallback) {
            img.dataset.fallback = '1';
            img.src = '/logo.jpg';
          }
        }}
      />
    </span>
  );
}
