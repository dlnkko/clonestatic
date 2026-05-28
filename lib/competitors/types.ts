/** Meta Ad Library raw ad shape from ScrapeCreators (used by static library ingest). */
export type CompetitorAdSnapshot = {
  ad_archive_id?: string;
  page_name?: string;
  snapshot?: {
    body?: { text?: string };
    images?: { resized_image_url?: string; original_image_url?: string }[];
    cards?: { resized_image_url?: string; original_image_url?: string }[];
  };
  total_impressions?: number;
  total_active_time?: number;
  start_date?: number;
  end_date?: number;
};
