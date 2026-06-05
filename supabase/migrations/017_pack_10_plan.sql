-- One-time 10 Ads pack ($9.99 via Whop plan_J9fyEIeUSVd8d)

alter table public.subscriptions drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('standard', 'pro', 'scale', 'pack_10'));

comment on column public.subscriptions.plan is 'standard|pro|scale = recurring Whop; pack_10 = one-time 10 ads purchase';
