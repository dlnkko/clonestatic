'use client';

import type { ProductImage } from '@/lib/products/types';
import { ProxiedImage } from '@/app/components/ProxiedImage';

export type ScrapedImagePickerMode = 'logo' | 'product';

type Props = {
  mode: ScrapedImagePickerMode;
  images: ProductImage[];
  selectedUrls: string[];
  reservedUrls?: string[];
  max: number;
  onChange: (urls: string[]) => void;
};

function urlKey(url: string): string {
  return url.split('?')[0];
}

export function ScrapedImagePicker({
  mode,
  images,
  selectedUrls,
  reservedUrls = [],
  max,
  onChange,
}: Props) {
  const reserved = new Set(reservedUrls.map(urlKey));
  const selected = new Set(selectedUrls.map(urlKey));

  const toggle = (url: string) => {
    const key = urlKey(url);
    if (reserved.has(key) && mode === 'product') return;

    if (selected.has(key)) {
      onChange(selectedUrls.filter((u) => urlKey(u) !== key));
      return;
    }

    if (mode === 'logo') {
      onChange([url]);
      return;
    }

    if (selectedUrls.length >= max) return;
    onChange([...selectedUrls, url]);
  };

  if (images.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-xs text-slate-500">
        No images found on this page. You can upload your own on the next step.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {images.map((img) => {
        const key = urlKey(img.url);
        const isSelected = selected.has(key);
        const isReserved = reserved.has(key) && mode === 'product' && !isSelected;
        const isLogoHint = img.kind === 'logo';
        const disabled = isReserved || (!isSelected && mode === 'product' && selectedUrls.length >= max);

        return (
          <button
            key={img.url}
            type="button"
            disabled={disabled}
            onClick={() => toggle(img.url)}
            className={`group relative aspect-square overflow-hidden rounded-xl ring-2 transition-all ${
              isSelected
                ? 'ring-indigo-500 ring-offset-2'
                : disabled
                  ? 'cursor-not-allowed opacity-40 ring-slate-200'
                  : 'ring-slate-200 hover:ring-indigo-300'
            }`}
            aria-pressed={isSelected}
            aria-label={isSelected ? 'Deselect image' : 'Select image'}
          >
            <ProxiedImage
              src={img.url}
              alt={img.alt || ''}
              className={`h-full w-full ${isLogoHint ? 'object-contain bg-white p-1' : 'object-cover'}`}
            />
            {isLogoHint && mode === 'logo' && !isSelected && (
              <span className="absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white">
                Logo?
              </span>
            )}
            {isSelected && (
              <span className="absolute inset-0 flex items-center justify-center bg-indigo-600/25">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow">
                  ✓
                </span>
              </span>
            )}
            {isReserved && (
              <span className="absolute bottom-1 left-1 right-1 rounded bg-black/55 px-1 py-0.5 text-[9px] font-medium text-white">
                Logo
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
