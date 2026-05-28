'use client';

import { useEffect, useRef, useState } from 'react';

export type RevealDirection = 'up' | 'down';

export function useReveal<T extends HTMLElement>(
  direction: RevealDirection = 'up',
  options?: IntersectionObserverInit
) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
        } else {
          const above = entry.boundingClientRect.bottom < 0;
          const below = entry.boundingClientRect.top > window.innerHeight;
          if (above || below) setVisible(false);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -5% 0px', ...options }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);

  return { ref, visible, direction };
}
