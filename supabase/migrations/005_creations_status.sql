-- Allow creations to be "generating" (no image yet) so they appear in History
-- and get updated when the generation completes (even if the user refreshed).

alter table public.creations
  add column if not exists status text not null default 'completed' check (status in ('generating', 'completed'));

-- Allow image_url to be null when status = 'generating'
alter table public.creations
  alter column image_url drop not null;

comment on column public.creations.status is 'generating = in progress; completed = has image_url.';
