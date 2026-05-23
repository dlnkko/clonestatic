-- Cache for ScrapeCreators competitor ads results (keyed by search keyword, valid 24h).

create table if not exists public.competitor_ads_cache (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_competitor_ads_cache_keyword_created
  on public.competitor_ads_cache (keyword, created_at desc);

comment on table public.competitor_ads_cache is 'Cached ScrapeCreators API results per keyword; cache valid 24 hours';

alter table public.competitor_ads_cache enable row level security;

create policy "Allow authenticated read and insert"
  on public.competitor_ads_cache for all
  to authenticated
  using (true)
  with check (true);
