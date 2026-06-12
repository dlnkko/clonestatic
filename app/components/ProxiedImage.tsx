'use client';

import { useCallback, useEffect, useState } from 'react';
import { displayImageUrl, shouldBypassImageProxy } from '@/lib/display-image-url';
import { cn } from '@/lib/cn';

type ProxiedImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  fallbackClassName?: string;
};

type LoadMode = 'proxy' | 'direct' | 'failed';

/** Loads external image URLs via same-origin proxy when needed (fixes mobile CDN / hotlink failures). */
export function ProxiedImage({
  src,
  alt = '',
  className,
  fallbackClassName,
  onError,
  ...rest
}: ProxiedImageProps) {
  const [mode, setMode] = useState<LoadMode>(() =>
    shouldBypassImageProxy(src) ? 'direct' : 'proxy'
  );

  useEffect(() => {
    setMode(shouldBypassImageProxy(src) ? 'direct' : 'proxy');
  }, [src]);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (mode === 'proxy' && src.startsWith('http')) {
        setMode('direct');
        return;
      }
      setMode('failed');
      onError?.(e);
    },
    [mode, onError, src]
  );

  if (!src) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-slate-100 text-[10px] text-slate-400',
          fallbackClassName,
          className
        )}
      >
        —
      </div>
    );
  }

  if (mode === 'failed') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-0.5 overflow-hidden bg-slate-100 p-1 text-center',
          fallbackClassName
        )}
      >
        <span className="text-[9px] font-medium leading-tight text-slate-500">Error</span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] font-semibold leading-tight text-indigo-600 underline"
        >
          Abrir
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
      className={className}
      onError={handleError}
    />
  );
}
