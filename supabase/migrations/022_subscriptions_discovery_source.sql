-- Attribution: how the buyer discovered admirror (post-purchase onboarding).
alter table public.subscriptions
  add column if not exists discovery_source text;

comment on column public.subscriptions.discovery_source is
  'First-touch discovery answer from post-purchase onboarding (ads, x, reddit, …).';
