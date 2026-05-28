import { imageUrlsFromAd } from '@/lib/competitors/normalize-ads';
import type { CompetitorAdSnapshot } from '@/lib/competitors/types';

export type RawAdExtract = {
  adArchiveId: string;
  imageUrl: string;
  pageName: string | null;
  bodyPreview: string | null;
  totalImpressions: number | null;
};

export function extractAdsFromRaw(
  raw: unknown,
  options: { requireArchiveId?: boolean } = {}
): RawAdExtract[] {
  const ad = raw as CompetitorAdSnapshot;
  const imageUrls = imageUrlsFromAd(ad);
  if (imageUrls.length === 0) return [];

  const archiveId =
    typeof ad.ad_archive_id === 'string' && ad.ad_archive_id.trim()
      ? ad.ad_archive_id.trim()
      : null;

  if (options.requireArchiveId && !archiveId) return [];

  const id = archiveId ?? `hash-${imageUrls[0].slice(-40)}`;
  const pageName = ad.page_name?.trim() || null;
  const bodyPreview = ad.snapshot?.body?.text?.trim().slice(0, 500) || null;
  const totalImpressions =
    typeof ad.total_impressions === 'number' ? ad.total_impressions : null;

  return [
    {
      adArchiveId: id,
      imageUrl: imageUrls[0],
      pageName,
      bodyPreview,
      totalImpressions,
    },
  ];
}
