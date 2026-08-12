-- Allow all one-time credit pack plan keys (app writes pack_20 … pack_500).
-- Previous check only allowed pack_10, so Whop upserts for other packs failed → 0 credits.

alter table public.subscriptions drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (
    plan in (
      'standard',
      'pro',
      'scale',
      'pack_10',
      'pack_20',
      'pack_30',
      'pack_50',
      'pack_70',
      'pack_120',
      'pack_150',
      'pack_200',
      'pack_300',
      'pack_400',
      'pack_500'
    )
  );

comment on column public.subscriptions.plan is
  'standard|pro|scale = recurring Whop; pack_* = one-time credit packs';
