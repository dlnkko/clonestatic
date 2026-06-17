'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import {
  COPY_LANGUAGE_REGION_LABELS,
  COPY_LANGUAGES,
  copyLanguageRegions,
  getCopyLanguage,
  type CopyLanguageOption,
} from '@/lib/copy-languages';

type Props = {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  disabled?: boolean;
};

const PANEL_GAP = 6;
const PANEL_MAX_HEIGHT = 288;

function regionLabel(region: CopyLanguageOption['region'], locale: string): string {
  const labels = COPY_LANGUAGE_REGION_LABELS[region];
  if (locale === 'es') return labels.es;
  if (locale === 'pt') return labels.pt;
  return labels.en;
}

function matchesQuery(lang: CopyLanguageOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    lang.code.toLowerCase().includes(q) ||
    lang.label.toLowerCase().includes(q) ||
    lang.name.toLowerCase().includes(q) ||
    lang.subtitle.toLowerCase().includes(q)
  );
}

type PanelStyle = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
};

export function CopyLanguagePicker({ value, onChange, className, disabled }: Props) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [panelStyle, setPanelStyle] = useState<PanelStyle | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = getCopyLanguage(value);

  const grouped = useMemo(() => {
    return copyLanguageRegions()
      .map((region) => ({
        region,
        label: regionLabel(region, locale),
        items: COPY_LANGUAGES.filter((l) => l.region === region && matchesQuery(l, query)),
      }))
      .filter((g) => g.items.length > 0);
  }, [query, locale]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePanelPosition = () => {
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - PANEL_GAP;
    const spaceAbove = rect.top - PANEL_GAP;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;

    if (openUp) {
      setPanelStyle({
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + PANEL_GAP,
        maxHeight: Math.min(PANEL_MAX_HEIGHT, Math.max(160, spaceAbove)),
        openUp: true,
      });
      return;
    }

    setPanelStyle({
      left: rect.left,
      width: rect.width,
      top: rect.bottom + PANEL_GAP,
      maxHeight: Math.min(PANEL_MAX_HEIGHT, Math.max(160, spaceBelow)),
      openUp: false,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }
    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open, query, grouped.length]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
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

  const searchPlaceholder =
    locale === 'es' ? 'Buscar idioma…' : locale === 'pt' ? 'Buscar idioma…' : 'Search language…';
  const emptyLabel =
    locale === 'es' ? 'Sin resultados' : locale === 'pt' ? 'Sem resultados' : 'No results';

  const panel =
    open && panelStyle && mounted ? (
      <div
        ref={panelRef}
        id={listId}
        role="listbox"
        className={cn(
          'copy-language-panel copy-language-panel-floating',
          panelStyle.openUp && 'copy-language-panel-up'
        )}
        style={{
          position: 'fixed',
          left: panelStyle.left,
          width: panelStyle.width,
          top: panelStyle.top,
          bottom: panelStyle.bottom,
          maxHeight: panelStyle.maxHeight,
          zIndex: 400,
        }}
      >
        <div className="copy-language-search-wrap">
          <svg
            className="copy-language-search-icon"
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
            placeholder={searchPlaceholder}
            className="copy-language-search"
          />
        </div>

        <ul className="copy-language-list">
          {grouped.length === 0 ? (
            <li className="copy-language-empty">{emptyLabel}</li>
          ) : (
            grouped.map((group) => (
              <li key={group.region}>
                <p className="copy-language-group-label">{group.label}</p>
                <ul>
                  {group.items.map((lang) => {
                    const isSelected = lang.code === selected.code;
                    const isRtl = lang.code === 'ar' || lang.code === 'he' || lang.code === 'fa';
                    return (
                      <li key={lang.code} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={cn(
                            'copy-language-option',
                            isSelected && 'copy-language-option-selected',
                            isRtl && 'copy-language-option-rtl'
                          )}
                          onClick={() => pick(lang.code)}
                        >
                          <span className="copy-language-option-glyph" aria-hidden>
                            {lang.label.charAt(0)}
                          </span>
                          <span className="copy-language-option-body">
                            <span className="copy-language-option-label">{lang.label}</span>
                            <span className="copy-language-option-sub">{lang.subtitle}</span>
                          </span>
                          <span className="copy-language-option-code">
                            {lang.code.toUpperCase()}
                          </span>
                          {isSelected && (
                            <svg
                              className="copy-language-check"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              aria-hidden
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
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
    ) : null;

  return (
    <div ref={rootRef} className={cn('copy-language-picker', open && 'copy-language-picker-open', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn('copy-language-trigger', open && 'copy-language-trigger-open')}
      >
        <span className="copy-language-trigger-glyph" aria-hidden>
          {selected.label.charAt(0)}
        </span>
        <span className="copy-language-trigger-body">
          <span className="copy-language-trigger-label">{selected.label}</span>
          <span className="copy-language-trigger-sub">{selected.subtitle}</span>
        </span>
        <span className="copy-language-trigger-code">{selected.code.toUpperCase()}</span>
        <svg
          className={cn('copy-language-chevron', open && 'copy-language-chevron-open')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
