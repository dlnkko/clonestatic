'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { ProductRecord } from '@/lib/products/types';

function formatProductLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const mostlyUpper = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  if (mostlyUpper && trimmed.length > 6) {
    return trimmed
      .toLowerCase()
      .split(/(\s+|[-–—/])/)
      .map((part) => {
        if (!part || /^[\s\-–—/]+$/.test(part)) return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join('');
  }
  return trimmed;
}

export function ProductSourcePicker({
  products,
  value,
  onChange,
  className,
}: {
  products: ProductRecord[];
  value: string | null;
  onChange: (productId: string | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = products.find((p) => p.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('dash-product-picker', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={cn('dash-product-picker-trigger', open && 'dash-product-picker-trigger-open')}
      >
        {selected ? (
          <>
            <img src={selected.primary_image_url} alt="" className="dash-product-picker-thumb" />
            <span className="dash-product-picker-value">{formatProductLabel(selected.name)}</span>
          </>
        ) : (
          <>
            <span className="dash-product-picker-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="m7.5 4.27 9 5.15" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
              </svg>
            </span>
            <span className="dash-product-picker-value dash-product-picker-placeholder">Select a product</span>
          </>
        )}
        <svg
          className={cn('dash-combobox-chevron', open && 'dash-combobox-chevron-open')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul id={listId} role="listbox" className="dash-product-picker-menu">
          {products.map((p) => {
            const isSelected = p.id === value;
            return (
              <li key={p.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn('dash-product-picker-option', isSelected && 'dash-product-picker-option-selected')}
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <img src={p.primary_image_url} alt="" className="dash-product-picker-option-thumb" />
                  <span className="dash-product-picker-option-text">
                    <span className="dash-product-picker-option-title">{formatProductLabel(p.name)}</span>
                    <span className="dash-product-picker-option-sub">
                      {p.source === 'url' ? 'From URL' : 'Manual'} · {p.images.length} image{p.images.length !== 1 ? 's' : ''}
                    </span>
                  </span>
                  {isSelected && (
                    <svg className="dash-combobox-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
