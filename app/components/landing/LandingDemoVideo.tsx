'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

const DEMO_SRC = '/landing/demo.mp4';
const DEMO_POSTER = '/landing/hero-generated.png';

export function LandingDemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = () => {
      void v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    };
    tryPlay();
  }, []);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v || failed) return;
    if (v.paused) {
      void v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [failed]);

  return (
    <div className="landing-demo-frame relative mx-auto w-full overflow-hidden">
      {!failed ? (
        <video
          ref={videoRef}
          className="aspect-video w-full bg-black object-cover"
          src={DEMO_SRC}
          poster={DEMO_POSTER}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setFailed(true)}
          aria-label="admirror product demo"
        />
      ) : (
        <div
          className="flex aspect-video w-full items-center justify-center bg-[#0a0a0b]"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(10,10,11,0.35), rgba(10,10,11,0.75)), url(${DEMO_POSTER})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          role="img"
          aria-label="Demo video coming soon — product preview"
        />
      )}

      <button
        type="button"
        onClick={toggle}
        className={cn(
          'landing-demo-play absolute inset-0 flex items-center justify-center transition-opacity duration-300',
          playing && !failed ? 'opacity-0 hover:opacity-100' : 'opacity-100'
        )}
        aria-label={failed ? 'Demo video unavailable' : playing ? 'Pause demo' : 'Play demo'}
        disabled={failed}
      >
        <span className="landing-demo-play-btn flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-md sm:h-20 sm:w-20">
          {failed ? (
            <span className="px-2 text-center text-[10px] font-medium uppercase tracking-wider text-white/70">
              Soon
            </span>
          ) : playing ? (
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg className="ml-1 h-8 w-8" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.14v13.72L19 12 8 5.14z" />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}
