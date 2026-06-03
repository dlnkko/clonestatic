'use client';

import { useState } from 'react';

type Props = {
  colors: string[];
  onChange: (colors: string[]) => void;
  max?: number;
};

function normalizeHex(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const raw = v.startsWith('#') ? v : `#${v}`;
  if (!/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(raw)) return null;
  if (raw.length === 4) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return raw.toUpperCase();
}

export function BrandColorPicker({ colors, onChange, max = 8 }: Props) {
  const [pickerColor, setPickerColor] = useState('#6366F1');
  const [hexInput, setHexInput] = useState('');

  const addColor = () => {
    const c = normalizeHex(hexInput || pickerColor);
    if (!c || colors.includes(c) || colors.length >= max) return;
    onChange([...colors, c]);
    setHexInput('');
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="block text-xs font-medium text-slate-600">Brand colors</label>
        {colors.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(colors.filter((x) => x !== c))}
            className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300"
            title="Remove color"
          >
            <span className="h-4 w-4 rounded-full ring-1 ring-slate-200" style={{ background: c }} />
            <span>{c}</span>
            <span className="text-slate-400 group-hover:text-slate-600">✕</span>
          </button>
        ))}
        {colors.length === 0 && (
          <span className="text-xs text-slate-500">Pick a color, then press Add (1–{max} colors).</span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="color"
          aria-label="Pick color"
          value={pickerColor}
          onChange={(e) => setPickerColor(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          placeholder="#1F2937"
          className="dash-input flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addColor();
            }
          }}
        />
        <button
          type="button"
          onClick={addColor}
          disabled={colors.length >= max}
          className="dash-btn dash-btn-secondary shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  );
}
