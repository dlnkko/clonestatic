-- Global static ad library (shared across all users).

create table if not exists public.static_ad_library_runs (
  id uuid primary key default gen_random_uuid(),
  period_key text not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  credits_used int not null default 0,
  ads_inserted int not null default 0,
  ads_updated int not null default 0,
  ads_skipped int not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_static_ad_library_runs_period
  on public.static_ad_library_runs (period_key desc, started_at desc);

create table if not exists public.static_ad_seeds (
  id uuid primary key default gen_random_uuid(),
  seed_type text not null check (seed_type in ('keyword', 'company')),
  value text not null,
  category text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  unique (seed_type, value)
);

create index if not exists idx_static_ad_seeds_active
  on public.static_ad_seeds (active, seed_type, sort_order);

create table if not exists public.static_ads (
  id uuid primary key default gen_random_uuid(),
  ad_archive_id text not null unique,
  image_storage_path text not null,
  page_name text,
  body_preview text,
  category text not null,
  source text not null check (source in ('keyword', 'company')),
  seed_label text not null,
  period_key text not null,
  scraped_at timestamptz not null default now(),
  metadata jsonb
);

create index if not exists idx_static_ads_category on public.static_ads (category);
create index if not exists idx_static_ads_period on public.static_ads (period_key desc);
create index if not exists idx_static_ads_scraped on public.static_ads (scraped_at desc);
create index if not exists idx_static_ads_page_name on public.static_ads (page_name);

comment on table public.static_ads is 'Global Meta meme static ads mirrored to Storage';
comment on table public.static_ad_seeds is 'Curated keywords and Meta page names for library ingest';
comment on table public.static_ad_library_runs is 'Ingest job audit log';

alter table public.static_ads enable row level security;
alter table public.static_ad_seeds enable row level security;
alter table public.static_ad_library_runs enable row level security;

create policy "Authenticated users read static ads"
  on public.static_ads for select
  to authenticated
  using (true);

create policy "Authenticated users read seeds"
  on public.static_ad_seeds for select
  to authenticated
  using (true);

create policy "Authenticated users read ingest runs"
  on public.static_ad_library_runs for select
  to authenticated
  using (true);

-- Storage bucket for mirrored ad images (public read).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'static-ad-library',
  'static-ad-library',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set public = true;

create policy "Public read static ad images"
  on storage.objects for select
  to public
  using (bucket_id = 'static-ad-library');

create policy "Service role upload static ad images"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'static-ad-library');

create policy "Service role update static ad images"
  on storage.objects for update
  to service_role
  using (bucket_id = 'static-ad-library');
