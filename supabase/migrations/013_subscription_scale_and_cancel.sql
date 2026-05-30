-- Scale plan + Whop membership id + cancellation flag

alter table public.subscriptions drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('standard', 'pro', 'scale'));

alter table public.subscriptions
  add column if not exists whop_membership_id text,
  add column if not exists cancel_at_period_end boolean not null default false;

create index if not exists subscriptions_whop_membership_id_idx
  on public.subscriptions (whop_membership_id)
  where whop_membership_id is not null;

comment on column public.subscriptions.whop_membership_id is 'Whop mem_xxx id for API cancel/resume';
comment on column public.subscriptions.cancel_at_period_end is 'True when user requested cancel at period end via Whop';
