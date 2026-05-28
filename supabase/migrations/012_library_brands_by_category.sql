-- Aggregated brand list per category (for library drill-down UI).

create or replace function public.library_brands_by_category(p_category text)
returns table (
  brand_name text,
  ad_count bigint,
  max_impressions bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    trim(page_name) as brand_name,
    count(*)::bigint as ad_count,
    max(
      coalesce(
        total_impressions,
        nullif((metadata->>'total_impressions')::bigint, 0)
      )
    )::bigint as max_impressions
  from public.static_ads
  where category = p_category
    and page_name is not null
    and trim(page_name) <> ''
  group by trim(page_name)
  order by max_impressions desc nulls last, ad_count desc, brand_name asc;
$$;

revoke all on function public.library_brands_by_category(text) from public;
grant execute on function public.library_brands_by_category(text) to authenticated;
