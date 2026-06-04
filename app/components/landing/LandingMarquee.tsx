'use client';

const ITEMS = [
  'Mirror static ads',
  'Meta Ad Library',
  'Refreshed monthly',
  'Sorted by impressions',
  'Product page sync',
  'Copy that matches your brand',
  'No prompt engineering',
  'HD export',
  'Saved products',
  'Browse by category',
  'Ship in minutes',
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
