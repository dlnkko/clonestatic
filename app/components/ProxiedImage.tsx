'use client';

import { useCallback, useState } from 'react';
import { displayImageUrl } from '@/lib/display-image-url';
import { cn } from '@/lib/cn';

type ProxiedImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  fallbackClassName?: string;
};

/** Loads external image URLs via same-origin proxy (fixes mobile CDN / hotlink failures). */
export function ProxiedImage({
  src,
  alt = '',
  className,
  fallbackClassName,
  onError,
  ...rest
}: ProxiedImageProps) {
  const [failed, setFailed] = useState(false);
  const proxied = displayImageUrl(src);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setFailed(true);
      onError?.(e);
    },
    [onError]
  );

  if (failed) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 bg-slate-100 p-4 text-center',
          fallbackClassName,
          className
        )}
      >
        <span className="text-xs font-medium text-slate-600">No se pudo cargar la imagen</span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-indigo-600 underline"
        >
          Abrir enlace directo
        </a>
      </div>
    );
  }

  return (
    <img
      {...rest}
      src={proxied}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
}
