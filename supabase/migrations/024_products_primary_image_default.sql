-- Allow products saved without photos: never persist a null primary URL.
alter table public.products
  alter column primary_image_url set default '/product-thumb-placeholder.svg';
