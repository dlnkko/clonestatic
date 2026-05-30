import { NextRequest, NextResponse } from 'next/server';
import { getAdsDateRange } from '@/lib/competitors/dates';
import { getLatestLibraryRun, getLibraryAdCount } from '@/lib/static-library/ingest';
import { getLibraryCategories, queryLibraryBrands, queryStaticLibrary } from '@/lib/static-library/query';
import { LIBRARY_CATEGORIES } from '@/lib/static-library/seeds-mvp';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');
    const category = searchParams.get('category');
    const brand = searchParams.get('brand');
    const keyword = searchParams.get('keyword');
    const brandSearch = searchParams.get('brandSearch');
    const cursor = searchParams.get('cursor');

    if (view === 'brands') {
      if (!category || category === 'all') {
        return NextResponse.json(
          { error: 'Select a category to browse brands' },
          { status: 400 }
        );
      }
      const brands = await queryLibraryBrands(supabase, category, brandSearch);
      return NextResponse.json({
        success: true,
        view: 'brands',
        category,
        brands,
      });
    }

    const { ads, nextCursor, sort, filteredCount } = await queryStaticLibrary(supabase, {
      category,
      brand,
      keyword,
      cursor,
      limit: 48,
    });

    const [totalCount, categories, lastRun] = await Promise.all([
      getLibraryAdCount(),
      getLibraryCategories(supabase),
      getLatestLibraryRun(),
    ]);

    const period = getAdsDateRange();

    return NextResponse.json({
      success: true,
      view: brand ? 'brand-ads' : keyword ? 'keyword-ads' : 'browse',
      ads,
      nextCursor,
      totalCount,
      filteredCount,
      categories: categories.length > 0 ? categories : [...LIBRARY_CATEGORIES],
      period: {
        start_date: period.start_date,
        end_date: period.end_date,
        label: period.label,
      },
      meta: {
        sort,
        brand: brand ?? null,
        category: category && category !== 'all' ? category : null,
        lastRun: lastRun
          ? {
              status: lastRun.status,
              creditsUsed: lastRun.credits_used,
              adsInserted: lastRun.ads_inserted,
              finishedAt: lastRun.finished_at,
              periodKey: lastRun.period_key,
            }
          : null,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Library request failed';
    console.error('static-library GET error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
