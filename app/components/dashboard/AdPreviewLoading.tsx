'use client';

import { useEffect, useState } from 'react';

const LOADING_LINES = [
  { title: 'Getting your ad ready', subtitle: 'Mirroring the winning layout for your brand.' },
  { title: 'Crafting your creative', subtitle: 'This usually takes about a minute.' },
  { title: 'Polishing the details', subtitle: 'Your ad will show up here when it\'s done.' },
  { title: 'Almost there', subtitle: 'Good creatives are worth the wait.' },
] as const;

type Props = {
  /** Brief upload phase before server job starts */
  phase?: 'upload' | 'generate';
};

export function AdPreviewLoading({ phase = 'generate' }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (phase === 'upload') return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % LOADING_LINES.length);
    }, 3500);
    return () => window.clearInterval(id);
  }, [phase]);

  const line =
    phase === 'upload'
      ? { title: 'Getting your ad ready', subtitle: 'Uploading your images…' }
      : LOADING_LINES[index];

  return (
    <div
      className="flex w-full flex-col items-center px-4 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="dash-preview-skeleton w-full max-w-[280px]" aria-hidden>
        <div className="dash-preview-skeleton-inner">
          <div className="dash-preview-skeleton-line dash-preview-skeleton-line--lg" />
          <div className="dash-preview-skeleton-line dash-preview-skeleton-line--md" />
          <div className="dash-preview-skeleton-line dash-preview-skeleton-line--sm" />
          <div className="dash-preview-skeleton-product" />
          <div className="dash-preview-skeleton-line dash-preview-skeleton-line--xs" />
        </div>
      </div>
      <p className="mt-5 text-sm font-semibold text-slate-800">{line.title}</p>
      <p className="mt-1 max-w-[300px] text-xs leading-relaxed text-slate-500">{line.subtitle}</p>
    </div>
  );
}
