-- Allow failed background generations; retention purge deletes rows > 30 days (app logic).

alter table public.creations drop constraint if exists creations_status_check;

alter table public.creations
  add constraint creations_status_check
  check (status in ('generating', 'completed', 'failed'));

comment on column public.creations.status is 'generating = in progress; completed = has image_url; failed = job error.';
