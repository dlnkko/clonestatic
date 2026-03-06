-- Free trial: 1 generation per IP (hashed) to prevent abuse (same machine, many accounts).
-- API routes check this table before allowing a free generation when user has no subscription.

create table if not exists public.free_trial_ips (
  ip_hash text primary key,
  used_at timestamptz not null default now()
);

create index if not exists free_trial_ips_used_at_idx on public.free_trial_ips (used_at);

alter table public.free_trial_ips enable row level security;

comment on table public.free_trial_ips is 'IPs (hashed) that have already used their 1 free trial generation. No policies: only service_role (API) can access.';
