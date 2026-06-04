alter table public.creations
  add column if not exists error_message text;

comment on column public.creations.error_message is 'Last failure reason when status = failed (server job).';
