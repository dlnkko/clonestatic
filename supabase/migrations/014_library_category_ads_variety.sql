-- Category browse: interleave top ads per brand, prioritizing brands with the most ads.

create or replace function public.library_category_ads_variety(
  p_category text,
  p_offset int default 0,
  p_limit int default 48
)
returns table (
  id uuid,
  ad_archive_id text,
  image_storage_path text,
  page_name text,
  body_preview text,
  category text,
  source text,
  seed_label text,
  scraped_at timestamptz,
  total_impressions bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with brand_counts as (
    select trim(page_name) as brand_name, count(*)::bigint as ad_count
    from public.static_ads
    where category = p_category
      and page_name is not null
      and trim(page_name) <> ''
    group by trim(page_name)
  ),
  ranked as (
    select
      s.id,
      s.ad_archive_id,
      s.image_storage_path,
      s.page_name,
      s.body_preview,
      s.category,
      s.source,
      s.seed_label,
      s.scraped_at,
      coalesce(
        s.total_impressions,
        nullif((s.metadata->>'total_impressions')::bigint, 0)
      ) as total_impressions,
      bc.ad_count as brand_ad_count,
      row_number() over (
        partition by trim(s.page_name)
        order by
          coalesce(
            s.total_impressions,
            nullif((s.metadata->>'total_impressions')::bigint, 0)
          ) desc nulls last,
          s.scraped_at desc,
          s.id desc
      ) as brand_ad_rank
    from public.static_ads s
    inner join brand_counts bc on trim(s.page_name) = bc.brand_name
    where s.category = p_category
  ),
  ordered as (
    select
      r.*,
      row_number() over (
        order by
          r.brand_ad_rank asc,
          r.brand_ad_count desc,
          r.total_impressions desc nulls last,
          r.id desc
      ) as variety_idx
    from ranked r
  )
  select
    o.id,
    o.ad_archive_id,
    o.image_storage_path,
    o.page_name,
    o.body_preview,
    o.category,
    o.source,
    o.seed_label,
    o.scraped_at,
    o.total_impressions
  from ordered o
  where o.variety_idx > p_offset
    and o.variety_idx <= p_offset + p_limit
  order by o.variety_idx asc;
$$;

revoke all on function public.library_category_ads_variety(text, int, int) from public;
grant execute on function public.library_category_ads_variety(text, int, int) to authenticated;
