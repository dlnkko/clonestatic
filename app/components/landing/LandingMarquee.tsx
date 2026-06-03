'use client';

const ITEMS = [
  'Mirror static ads',
  'US Meta Ad Library',
  'Sort by impressions',
  'Product URL scrape',
  'Brand-matched copy',
  'No prompts needed',
  'HD export',
  'Saved products',
  'Ad library by niche',
  'Launch in minutes',
];

export function LandingMarquee() {
  const track = [...ITEMS, ...ITEMS];

  return (
    <div className="landing-marquee-wrap" aria-hidden>
      <div className="landing-marquee-fade landing-marquee-fade-left" />
      <div className="landing-marquee-fade landing-marquee-fade-right" />
      <div className="landing-marquee-track">
        {track.map((label, i) => (
          <span key={`${label}-${i}`} className="landing-marquee-item">
            <span className="landing-marquee-dot" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
