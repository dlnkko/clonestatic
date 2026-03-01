-- Table to store each user's generated ad images (for history tab).
-- Run this in Supabase SQL Editor after linking your project.
--
-- 1. In Supabase Dashboard: Authentication > Providers > enable "Anonymous" sign-in.
-- 2. Add to .env.local:
--    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
--    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
-- 3. Run this migration in SQL Editor.

create table if not exists public.creations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  image_url text not null,
  aspect_ratio text,
  prompt text,
  created_at timestamptz not null default now()
);

-- Index for listing by user and date
create index if not exists creations_user_id_created_at_idx
  on public.creations (user_id, created_at desc);

-- RLS: users can only see and insert their own rows
alter table public.creations enable row level security;

create policy "Users can read own creations"
  on public.creations for select
  using (auth.uid() = user_id);

create policy "Users can insert own creations"
  on public.creations for insert
  with check (auth.uid() = user_id);
