-- Add first-class impressions field for sorting/indexing.

alter table public.static_ads
add column if not exists total_impressions bigint;

create index if not exists idx_static_ads_impressions
  on public.static_ads (total_impressions desc nulls last);

-- Best-effort backfill from metadata JSON.
update public.static_ads
set total_impressions =
  nullif((metadata->>'total_impressions')::bigint, 0)
where total_impressions is null
  and metadata ? 'total_impressions';


