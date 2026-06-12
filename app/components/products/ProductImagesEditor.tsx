'use client';

import { useRef } from 'react';
import type { ProductImageKind } from '@/lib/products/types';
import { ProxiedImage } from '@/app/components/ProxiedImage';

export type EditableProductImage =
  | { key: string; source: 'remote'; url: string; kind: ProductImageKind }
  | { key: string; source: 'local'; preview: string; file: File; kind: ProductImageKind };

type SectionProps = {
  label: string;
  hint: string;
  max: number;
  images: EditableProductImage[];
  onChange: (images: EditableProductImage[]) => void;
  objectFit?: 'cover' | 'contain';
  defaultKind: ProductImageKind;
  replaceLabel: string;
  removeLabel: string;
  uploadLabel: string;
};

function ImageSection({
  label,
  hint,
  max,
  images,
  onChange,
  objectFit = 'cover',
  defaultKind,
  replaceLabel,
  removeLabel,
  uploadLabel,
}: SectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number | null>(null);

  const openPicker = (replaceIndex: number | null) => {
    replaceIndexRef.current = replaceIndex;
    inputRef.current?.click();
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const file = fileList[0];
    const replaceIndex = replaceIndexRef.current;
    replaceIndexRef.current = null;

    const nextItem: EditableProductImage = {
      key: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      source: 'local',
      preview: URL.createObjectURL(file),
      file,
      kind: defaultKind,
    };

    if (replaceIndex != null && replaceIndex >= 0 && replaceIndex < images.length) {
      const prev = images[replaceIndex];
      if (prev.source === 'local') URL.revokeObjectURL(prev.preview);
      onChange(images.map((img, i) => (i === replaceIndex ? nextItem : img)));
    } else if (images.length < max) {
      onChange([...images, nextItem]);
    }

    if (inputRef.current) inputRef.current.value = '';
  };

  const removeAt = (index: number) => {
    const target = images[index];
    if (target.source === 'local') URL.revokeObjectURL(target.preview);
    onChange(images.filter((_, i) => i !== index));
  };

  const slotCount = Math.min(max, Math.max(images.length + 1, Math.min(3, max)));

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <p className="mb-2 text-[11px] leading-relaxed text-slate-500">{hint}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((img, i) => (
          <div
            key={img.key}
            className="product-upload-slot product-upload-slot-filled group relative aspect-square overflow-hidden rounded-xl ring-1 ring-slate-200"
          >
            {img.source === 'remote' ? (
              <ProxiedImage
                src={img.url}
                alt=""
                className={`h-full w-full ${objectFit === 'contain' ? 'object-contain bg-white p-1' : 'object-cover'}`}
              />
            ) : (
              <img
                src={img.preview}
                alt=""
                className={`h-full w-full ${objectFit === 'contain' ? 'object-contain bg-white p-1' : 'object-cover'}`}
              />
            )}
            {img.kind === 'logo' && (
              <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[8px] text-white">Logo</span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex gap-0.5 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => openPicker(i)}
                className="flex-1 rounded bg-white/90 px-1 py-0.5 text-[9px] font-semibold text-slate-800"
              >
                {replaceLabel}
              </button>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="rounded bg-red-600/90 px-1.5 py-0.5 text-[9px] font-semibold text-white"
                aria-label={removeLabel}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {images.length < max &&
          Array.from({ length: Math.max(0, slotCount - images.length) }).map((_, i) => (
            <button
              key={`empty-${i}`}
              type="button"
              onClick={() => openPicker(null)}
              className="product-upload-slot aspect-square rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              <span className="flex h-full flex-col items-center justify-center gap-1 text-slate-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="text-[10px] font-medium">{uploadLabel}</span>
              </span>
            </button>
          ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="mt-1.5 text-[10px] text-slate-400">
        {images.length}/{max}
      </p>
    </div>
  );
}

type Props = {
  productImages: EditableProductImage[];
  logoImages: EditableProductImage[];
  onProductImagesChange: (images: EditableProductImage[]) => void;
  onLogoImagesChange: (images: EditableProductImage[]) => void;
  labels: {
    productImages: string;
    productImagesHint: string;
    logoImages: string;
    logoImagesHint: string;
    replace: string;
    remove: string;
    upload: string;
  };
};

export function productImagesFromRecord(
  images: { url: string; kind?: ProductImageKind }[]
): { productImages: EditableProductImage[]; logoImages: EditableProductImage[] } {
  const productImages: EditableProductImage[] = [];
  const logoImages: EditableProductImage[] = [];

  images.forEach((img, i) => {
    const item: EditableProductImage = {
      key: `remote-${img.url}-${i}`,
      source: 'remote',
      url: img.url,
      kind: img.kind === 'logo' ? 'logo' : (img.kind ?? 'product'),
    };
    if (img.kind === 'logo') logoImages.push(item);
    else productImages.push(item);
  });

  return { productImages, logoImages };
}

export function ProductImagesEditor({
  productImages,
  logoImages,
  onProductImagesChange,
  onLogoImagesChange,
  labels,
}: Props) {
  return (
    <div className="space-y-5">
      <ImageSection
        label={labels.productImages}
        hint={labels.productImagesHint}
        max={10}
        images={productImages}
        onChange={onProductImagesChange}
        defaultKind="product"
        replaceLabel={labels.replace}
        removeLabel={labels.remove}
        uploadLabel={labels.upload}
      />
      <ImageSection
        label={labels.logoImages}
        hint={labels.logoImagesHint}
        max={2}
        images={logoImages.map((img) => ({ ...img, kind: 'logo' as const }))}
        onChange={(next) => onLogoImagesChange(next.map((img) => ({ ...img, kind: 'logo' as const })))}
        objectFit="contain"
        defaultKind="logo"
        replaceLabel={labels.replace}
        removeLabel={labels.remove}
        uploadLabel={labels.upload}
      />
    </div>
  );
}

export async function readEditableImagesAsPayload(
  productImages: EditableProductImage[],
  logoImages: EditableProductImage[]
): Promise<Array<{ url?: string; base64?: string; kind?: ProductImageKind }>> {
  const readFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('Read failed'));
      r.readAsDataURL(file);
    });

  const slots: Array<{ url?: string; base64?: string; kind?: ProductImageKind }> = [];

  for (const img of productImages) {
    if (img.source === 'remote') slots.push({ url: img.url, kind: img.kind });
    else slots.push({ base64: await readFile(img.file), kind: img.kind });
  }
  for (const img of logoImages) {
    if (img.source === 'remote') slots.push({ url: img.url, kind: 'logo' });
    else slots.push({ base64: await readFile(img.file), kind: 'logo' });
  }

  return slots;
}
