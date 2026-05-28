import type { CompetitorAdSnapshot } from './types';

type SnapshotCard = {
  resized_image_url?: string;
  original_image_url?: string;
};

type SnapshotExtended = CompetitorAdSnapshot['snapshot'] & {
  cards?: SnapshotCard[];
};

export function canonicalizeImageUrl(url: string): string {
  const q = url.indexOf('?');
  const base = q >= 0 ? url.slice(0, q) : url;
  return base.trim();
}

export function imageUrlsFromAd(ad: CompetitorAdSnapshot): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  const push = (u?: string) => {
    if (!u || !u.startsWith('http')) return;
    const full = u.trim();
    const key = canonicalizeImageUrl(full);
    if (seen.has(key)) return;
    seen.add(key);
    urls.push(full);
  };

  for (const img of ad.snapshot?.images ?? []) {
    push(img.resized_image_url);
    push(img.original_image_url);
  }

  const snap = ad.snapshot as SnapshotExtended | undefined;
  for (const card of snap?.cards ?? []) {
    push(card.resized_image_url);
    push(card.original_image_url);
  }

  return urls;
}

export function adHasDisplayableImage(ad: unknown): boolean {
  return imageUrlsFromAd(ad as CompetitorAdSnapshot).length > 0;
}
