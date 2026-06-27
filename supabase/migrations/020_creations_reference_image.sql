-- Store which reference ad was used for each creation (shown in History).
alter table public.creations
  add column if not exists reference_image_url text;

comment on column public.creations.reference_image_url is 'Hosted URL of the reference ad image used to generate this creation.';
