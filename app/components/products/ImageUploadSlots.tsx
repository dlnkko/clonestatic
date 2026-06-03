'use client';

import { useRef } from 'react';

type Props = {
  label: string;
  hint: string;
  max: number;
  previews: string[];
  onChange: (files: File[]) => void;
  onRemove: (index: number) => void;
  objectFit?: 'cover' | 'contain';
};

export function ImageUploadSlots({
  label,
  hint,
  max,
  previews,
  onChange,
  onRemove,
  objectFit = 'cover',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const slotCount = Math.min(max, Math.max(previews.length + 1, Math.min(3, max)));

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    const room = max - previews.length;
    if (room <= 0) return;
    onChange(incoming.slice(0, room));
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <p className="mb-2 text-[11px] leading-relaxed text-slate-500">{hint}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {previews.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="product-upload-slot product-upload-slot-filled group relative aspect-square overflow-hidden rounded-xl ring-1 ring-slate-200"
          >
            <img
              src={src}
              alt=""
              className={`h-full w-full ${objectFit === 'contain' ? 'object-contain bg-white p-1' : 'object-cover'}`}
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Remove image"
            >
              ✕
            </button>
          </div>
        ))}
        {previews.length < max &&
          Array.from({ length: Math.max(0, slotCount - previews.length) }).map((_, i) => (
            <button
              key={`empty-${i}`}
              type="button"
              onClick={() => inputRef.current?.click()}
              className="product-upload-slot aspect-square rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              <span className="flex h-full flex-col items-center justify-center gap-1 text-slate-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="text-[10px] font-medium">Upload</span>
              </span>
            </button>
          ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={max > 1}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="mt-1.5 text-[10px] text-slate-400">
        {previews.length}/{max} selected
      </p>
    </div>
  );
}
