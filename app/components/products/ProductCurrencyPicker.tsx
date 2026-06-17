'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import {
  CURRENCY_REGION_LABELS,
  getProductCurrency,
  PRODUCT_CURRENCIES,
  type CurrencyOption,
  type CurrencyRegion,
} from '@/lib/products/currencies';

const REGION_ORDER: CurrencyRegion[] = ['americas', 'europe', 'other'];

type Props = {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  disabled?: boolean;
};

function currencyLabel(c: CurrencyOption, locale: string): string {
  return locale === 'es' || locale === 'pt' ? c.labelEs : c.label;
}

function matchesQuery(c: CurrencyOption, query: string, locale: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const label = currencyLabel(c, locale).toLowerCase();
  return (
    c.code.toLowerCase().includes(q) ||
    label.includes(q) ||
    c.symbol.toLowerCase().includes(q) ||
    c.label.toLowerCase().includes(q) ||
    c.labelEs.toLowerCase().includes(q)
  );
}

export function ProductCurrencyPicker({ value, onChange, className, disabled }: Props) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = getProductCurrency(value) ?? getProductCurrency('USD')!;

  const grouped = useMemo(() => {
    const filtered = PRODUCT_CURRENCIES.filter((c) => matchesQuery(c, query, locale));
    return REGION_ORDER.map((region) => ({
      region,
      label:
        locale === 'es' || locale === 'pt'
          ? CURRENCY_REGION_LABELS[region].es
          : CURRENCY_REGION_LABELS[region].en,
      items: filtered.filter((c) => c.region === region),
    })).filter((g) => g.items.length > 0);
  }, [query, locale]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className={cn('product-currency-picker', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn('product-currency-trigger', open && 'product-currency-trigger-open')}
      >
        <span className="product-currency-trigger-flag" aria-hidden>
          {selected.flag}
        </span>
        <span className="product-currency-trigger-body">
          <span className="product-currency-trigger-code">{selected.code}</span>
          <span className="product-currency-trigger-name">{currencyLabel(selected, locale)}</span>
        </span>
        <span className="product-currency-trigger-symbol">{selected.symbol}</span>
        <svg
          className={cn('product-currency-chevron', open && 'product-currency-chevron-open')}
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
        <div className="product-currency-panel">
          <div className="product-currency-search-wrap">
            <svg
              className="product-currency-search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M20 20l-3-3" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={locale === 'es' ? 'Buscar moneda…' : locale === 'pt' ? 'Buscar moeda…' : 'Search currency…'}
              className="product-currency-search"
            />
          </div>

          <ul id={listId} role="listbox" className="product-currency-list">
            {grouped.length === 0 ? (
              <li className="product-currency-empty">
                {locale === 'es' ? 'Sin resultados' : locale === 'pt' ? 'Sem resultados' : 'No results'}
              </li>
            ) : (
              grouped.map((group) => (
                <li key={group.region}>
                  <p className="product-currency-group-label">{group.label}</p>
                  <ul>
                    {group.items.map((c) => {
                      const isSelected = c.code === selected.code;
                      return (
                        <li key={c.code} role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={cn(
                              'product-currency-option',
                              isSelected && 'product-currency-option-selected'
                            )}
                            onClick={() => pick(c.code)}
                          >
                            <span className="product-currency-option-flag" aria-hidden>
                              {c.flag}
                            </span>
                            <span className="product-currency-option-body">
                              <span className="product-currency-option-code">{c.code}</span>
                              <span className="product-currency-option-name">
                                {currencyLabel(c, locale)}
                              </span>
                            </span>
                            <span className="product-currency-option-symbol">{c.symbol}</span>
                            {isSelected && (
                              <svg
                                className="product-currency-check"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                aria-hidden
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
