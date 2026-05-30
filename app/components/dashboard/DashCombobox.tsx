'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export type DashComboboxOption = {
  value: string;
  label: string;
  hint?: string;
};

export function DashCombobox({
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  className,
  disabled,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DashComboboxOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

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
    <div ref={rootRef} className={cn('dash-combobox', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn('dash-combobox-trigger', open && 'dash-combobox-trigger-open')}
      >
        <span className={cn('dash-combobox-value', !selected && 'dash-combobox-placeholder')}>
          {selected?.label ?? placeholder}
        </span>
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
        <ul id={listId} role="listbox" className="dash-combobox-menu">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li key={opt.value || '__empty'} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn('dash-combobox-option', isSelected && 'dash-combobox-option-selected')}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span className="dash-combobox-option-label">{opt.label}</span>
                  {opt.hint && <span className="dash-combobox-option-hint">{opt.hint}</span>}
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
