-- Prevent double-crediting the same Whop one-time payment (webhook + post-checkout sync).

alter table public.subscriptions
  add column if not exists last_credited_payment_id text;

comment on column public.subscriptions.last_credited_payment_id is
  'Last Whop pay_xxx id that already granted one-time pack credits';
