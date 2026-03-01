'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

type Props = {
  imageBefore?: string;
  imageAfter?: string;
  labelBefore?: string;
  labelAfter?: string;
  className?: string;
};

export function BeforeAfterSlider({
  imageBefore,
  imageAfter,
  labelBefore = 'Reference ad',
  labelAfter = 'AI-generated',
  className = '',
}: Props) {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(
    (clientX: number, container: HTMLDivElement) => {
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setPosition(pct);
    },
    []
  );

  const handleMove = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (el) updatePosition(clientX, el);
    },
    [updatePosition]
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      handleMove(clientX);
    },
    [isDragging, handleMove]
  );

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      handleMove(clientX);
    },
    [handleMove]
  );

  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const off = () => setIsDragging(false);
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length) handleMove(e.touches[0].clientX);
    };
    window.addEventListener('mouseup', off);
    window.addEventListener('touchend', off);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('mouseup', off);
      window.removeEventListener('touchend', off);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [isDragging, handleMove]);

  return (
    <div
      ref={containerRef}
      data-slider
      className={`relative w-full max-w-4xl mx-auto overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur-xl aspect-[2/1] sm:aspect-[2.2/1] select-none touch-none ${className}`}
      onMouseMove={handlePointerMove}
      onMouseLeave={handleEnd}
      onTouchMove={handlePointerMove}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      style={{ touchAction: 'none' }}
    >
      {/* Before (full layer) */}
      <div className="absolute inset-0">
        {imageBefore ? (
          <img
            src={imageBefore}
            alt={labelBefore}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-800/80">
            <div className="flex flex-col gap-2 text-left px-6">
              <div className="h-2 w-3/4 rounded bg-white/20" />
              <div className="h-2 w-1/2 rounded bg-white/15" />
              <div className="h-2 w-2/3 rounded bg-white/10" />
              <span className="mt-2 text-xs font-medium text-white/60">{labelBefore}</span>
            </div>
          </div>
        )}
      </div>

      {/* After (clipped by position) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {imageAfter ? (
          <img
            src={imageAfter}
            alt={labelAfter}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div
            className="h-full w-full bg-slate-700/90"
            style={{
              backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.04) 8px, rgba(255,255,255,0.04) 16px)`,
            }}
          >
            <div className="flex h-full items-center justify-end pr-6">
              <span className="text-xs font-medium text-white/70">{labelAfter}</span>
            </div>
          </div>
        )}
      </div>

      {/* Thick white vertical divider + circular handle (reference style) */}
      <div
        className="absolute top-0 bottom-0 w-14 cursor-ew-resize z-10 flex items-center justify-center sm:w-16"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
      >
        <div className="absolute inset-0 flex justify-center">
          <div className="w-1.5 flex-shrink-0 bg-white shadow-lg" />
        </div>
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-700 border border-white/20 shadow-xl transition-transform active:scale-95">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>

      {/* Pill labels */}
      <div className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm border border-white/10">
        {labelBefore}
      </div>
      <div className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm border border-white/10">
        {labelAfter}
      </div>
    </div>
  );
}
