export type StaticAdSeedType = 'keyword' | 'company';

export type StaticAdSeed = {
  id?: string;
  seed_type: StaticAdSeedType;
  value: string;
  category: string;
  active?: boolean;
  sort_order?: number;
  /** Keyword seed that repeats a brand name (Meta phrase search). */
  brand_keyword?: boolean;
  /** Original brand label before Meta page name correction (company seeds). */
  canonical_label?: string;
};

export type StaticAdRow = {
  id: string;
  ad_archive_id: string;
  image_storage_path: string;
  page_name: string | null;
  body_preview: string | null;
  category: string;
  source: StaticAdSeedType;
  seed_label: string;
  period_key: string;
  scraped_at: string;
  total_impressions?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type StaticAdLibraryRun = {
  id: string;
  period_key: string;
  status: 'running' | 'completed' | 'failed';
  credits_used: number;
  ads_inserted: number;
  ads_updated: number;
  ads_skipped: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
};

export type IngestMode = 'bootstrap' | 'refresh' | 'brand_bootstrap' | 'brand_refresh';

export type IngestOptions = {
  mode?: IngestMode;
  maxCredits?: number;
  maxPagesPerSeed?: number;
  periodKey?: string;
  /** Only ingest seeds whose canonical_label is in this list. */
  canonicalBrandLabels?: string[];
};

export type IngestResult = {
  runId: string;
  periodKey: string;
  creditsUsed: number;
  adsInserted: number;
  adsUpdated: number;
  adsSkipped: number;
  status: 'completed' | 'failed';
  error?: string;
};
