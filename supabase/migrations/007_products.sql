-- User products: branding + images for ad generation (URL scrape or manual entry).

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  source text not null check (source in ('url', 'manual')),
  product_url text,
  description text,
  target_audience text,
  color_palette jsonb,
  logo_url text,
  primary_image_url text not null,
  images jsonb not null default '[]'::jsonb,
  scrape_cache jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_user_id_created_at_idx
  on public.products (user_id, created_at desc);

alter table public.products enable row level security;

create policy "Users can read own products"
  on public.products for select
  using (auth.uid() = user_id);

create policy "Users can insert own products"
  on public.products for insert
  with check (auth.uid() = user_id);

create policy "Users can update own products"
  on public.products for update
  using (auth.uid() = user_id);

create policy "Users can delete own products"
  on public.products for delete
  using (auth.uid() = user_id);
