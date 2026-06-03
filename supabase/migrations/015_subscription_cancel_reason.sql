alter table public.subscriptions
  add column if not exists cancel_reason text;

comment on column public.subscriptions.cancel_reason is 'User-provided reason when scheduling cancellation';
