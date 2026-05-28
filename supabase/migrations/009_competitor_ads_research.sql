-- Full competitor ads research cache (per product + calendar month).

create table if not exists public.competitor_ads_research (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  period_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, period_key)
);

create index if not exists idx_competitor_ads_research_product_period
  on public.competitor_ads_research (product_id, period_key desc);

comment on table public.competitor_ads_research is 'Cached competitor + keyword Meta ad research per product and month (24h TTL checked in app)';

alter table public.competitor_ads_research enable row level security;

create policy "Users manage own competitor research"
  on public.competitor_ads_research for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
