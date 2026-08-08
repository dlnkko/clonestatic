'use client';

import { useCallback, useEffect, useState } from 'react';
import { displayImageUrl, shouldBypassImageProxy } from '@/lib/display-image-url';
import { cn } from '@/lib/cn';

type ProxiedImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  fallbackClassName?: string;
  /** Prefer raw URL first (product CDNs). Falls back to proxy on error. */
  preferDirect?: boolean;
};

type LoadMode = 'proxy' | 'direct' | 'failed';

function initialMode(src: string, preferDirect: boolean): LoadMode {
  if (!src.startsWith('http')) return 'direct';
  if (preferDirect || shouldBypassImageProxy(src)) return 'direct';
  return 'proxy';
}

/** Loads external image URLs via same-origin proxy when needed (fixes mobile CDN / hotlink failures). */
export function ProxiedImage({
  src,
  alt = '',
  className,
  fallbackClassName,
  preferDirect = false,
  onError,
  ...rest
}: ProxiedImageProps) {
  const [mode, setMode] = useState<LoadMode>(() => initialMode(src, preferDirect));

  useEffect(() => {
    setMode(initialMode(src, preferDirect));
  }, [src, preferDirect]);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (preferDirect) {
        if (mode === 'direct' && src.startsWith('http')) {
          setMode('proxy');
          return;
        }
      } else if (mode === 'proxy' && src.startsWith('http')) {
        setMode('direct');
        return;
      }
      setMode('failed');
      onError?.(e);
    },
    [mode, onError, preferDirect, src]
  );

  if (!src) {
    return (
      <div
        className={cn('bg-slate-100', fallbackClassName, className)}
        aria-hidden
      />
    );
  }

  if (mode === 'failed') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-0.5 overflow-hidden bg-slate-100 p-0.5 text-center',
          fallbackClassName,
          className
        )}
      >
        <span className="text-[8px] font-medium leading-tight text-slate-500">Error</span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[8px] font-semibold leading-tight text-indigo-600 underline"
          onClick={(e) => e.stopPropagation()}
        >
          Open
        </a>
      </div>
    );
  }

  const resolvedSrc = mode === 'direct' ? src : displayImageUrl(src);

  return (
    <img
      {...rest}
      src={resolvedSrc}
      alt={alt}
      className={cn('block object-cover', className)}
      referrerPolicy="no-referrer"
      decoding="async"
      onError={handleError}
    />
  );
}
