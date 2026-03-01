-- Subscriptions and credits for Whop payments.
-- Run this in Supabase SQL Editor after 001_creations.sql (if you use creations).
--
-- When a user pays via Whop, the webhook POST /api/webhooks/whop will upsert
-- a row here with their email, plan (standard/pro), and credits_remaining.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  plan text not null check (plan in ('standard', 'pro')),
  credits_remaining int not null default 0 check (credits_remaining >= 0),
  period_end date,
  whop_member_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_email_idx on public.subscriptions (email);
create index if not exists subscriptions_period_end_idx on public.subscriptions (period_end);

-- RLS: block anon/auth from reading or writing. Webhook and app APIs use service_role key and bypass RLS.
alter table public.subscriptions enable row level security;

-- No policies: no one can read/write via anon key. Only service_role (webhook + API routes) can access.
comment on table public.subscriptions is 'Whop-paid subscriptions: email, plan, credits. Updated by webhook.';
