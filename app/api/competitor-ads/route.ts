import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_MODEL } from '@/lib/gemini-model';
import { createClient } from '@/lib/supabase/server';

function getGoogleGenAI() {
  const key = process.env.GOOGLE_GENAI_API_KEY;
  if (!key) throw new Error('GOOGLE_GENAI_API_KEY is not set');
  return new GoogleGenAI({ apiKey: key });
}

function getScrapeCreatorsApiKey(): string {
  const key = process.env.SCRAPECREATORS_API_KEY?.trim();
  if (!key) throw new Error('SCRAPECREATORS_API_KEY is not set. Add it to .env.local');
  return key;
}

/** Normalize Gemini output for ScrapeCreators query: lowercase, spaces kept, collapse multiple spaces. */
function normalizeKeyword(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .slice(0, 80);
  return s || 'product';
}

/** Get search keyword from Gemini 1.5 Flash from either crawl summary (text) or product image. */
async function getKeywordFromGemini(options: {
  crawlSummary?: string;
  productImageBase64?: string;
}): Promise<string> {
  const ai = getGoogleGenAI();
  const { crawlSummary, productImageBase64 } = options;

  const systemPrompt = `You are a classifier for ad research. Given either (1) a text summary of a product page, or (2) a product image, you must output exactly ONE search phrase for finding competitor Facebook/Instagram ads in the same category.

Rules for the phrase:
- Use spaces between words. Lowercase only. No special characters, no hyphens or underscores.
- Examples: "creatine gummies", "whey protein", "sleep gummies", "skincare serum", "protein powder".
- It should be the product category or type as advertisers would write it in ad copy (with spaces).
- Output ONLY the phrase, nothing else — no explanation, no quotes, no punctuation.`;

  if (productImageBase64 && productImageBase64.length > 100) {
    const base64Only = productImageBase64.includes(',') ? productImageBase64.split(',')[1] : productImageBase64;
    const mimeMatch = productImageBase64.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const buffer = Buffer.from(base64Only, 'base64');
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });

    const uploaded = await ai.files.upload({ file: blob, config: { mimeType } });
    if (!uploaded.uri) throw new Error('Failed to upload image to Gemini');

    let file = uploaded;
    const maxWait = 60000;
    const start = Date.now();
    while (file.state !== 'ACTIVE' && Date.now() - start < maxWait) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const name = file.name || file.uri?.split('/').pop() || '';
        if (name) file = await ai.files.get({ name });
      } catch {
        // ignore
      }
    }
    if (file.state !== 'ACTIVE' || !file.uri) throw new Error('Image file not ready in time');

    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri: file.uri, mimeType: file.mimeType || mimeType } },
            { text: `${systemPrompt}\n\nOutput only the search phrase (e.g. creatine gummies):` },
          ],
        },
      ],
    });
    const text = result.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('').trim();
    if (!text) throw new Error('No keyword from Gemini');
    return normalizeKeyword(text);
  }

  if (crawlSummary && typeof crawlSummary === 'string' && crawlSummary.trim()) {
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\nProduct page summary:\n${crawlSummary.trim().slice(0, 8000)}\n\nOutput only the search phrase (e.g. creatine gummies):` },
          ],
        },
      ],
    });
    const text = result.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('').trim();
    if (!text) throw new Error('No keyword from Gemini');
    return normalizeKeyword(text);
  }

  throw new Error('Either crawlSummary or productImageBase64 is required');
}

function getDateParams(): { start_date: string; end_date: string } {
  const now = new Date();
  const end_date = now.toISOString().slice(0, 10);
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const start_date = threeMonthsAgo.toISOString().slice(0, 10);
  return { start_date, end_date };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const body = await request.json();
    const { productImageBase64, crawlSummary } = body as { productImageBase64?: string; crawlSummary?: string };

    if (!productImageBase64 && !crawlSummary) {
      return NextResponse.json(
        { error: 'Either productImageBase64 (product image) or crawlSummary (from URL crawl) is required' },
        { status: 400 }
      );
    }

    const keyword = await getKeywordFromGemini({ crawlSummary, productImageBase64 });
    if (!keyword) {
      return NextResponse.json({ error: 'Could not derive search keyword' }, { status: 400 });
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabase
      .from('competitor_ads_cache')
      .select('id, results, created_at')
      .eq('keyword', keyword)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.results) {
      return NextResponse.json({
        keyword,
        results: cached.results as unknown,
        cached: true,
        created_at: cached.created_at,
      });
    }

    const apiKey = getScrapeCreatorsApiKey();
    const { start_date, end_date } = getDateParams();

    const TARGET_RESULTS = 200;
    const MAX_PAGES = 5;

    async function fetchScrapeCreators(
      searchType: 'keyword_exact_phrase' | 'keyword_unordered',
      cursor?: string
    ): Promise<{ results: unknown[]; searchResultsCount?: number; cursor?: string }> {
      const url = new URL('https://api.scrapecreators.com/v1/facebook/adLibrary/search/ads');
      url.searchParams.set('query', keyword);
      url.searchParams.set('sort_by', 'total_impressions');
      url.searchParams.set('search_type', searchType);
      url.searchParams.set('ad_type', 'all');
      url.searchParams.set('status', 'ALL');
      url.searchParams.set('media_type', 'IMAGE');
      url.searchParams.set('start_date', start_date);
      url.searchParams.set('end_date', end_date);
      url.searchParams.set('trim', 'true');
      if (cursor) url.searchParams.set('cursor', cursor);

      console.log('[competitor-ads] ScrapeCreators request', { keyword, searchType, hasCursor: !!cursor });

      const res = await fetch(url.toString(), {
        headers: { 'x-api-key': apiKey },
      });

      const rawBody = await res.text();
      if (!res.ok) {
        console.error('[competitor-ads] ScrapeCreators API error', res.status, rawBody.slice(0, 500));
        throw new Error(`ScrapeCreators API ${res.status}: ${rawBody.slice(0, 200)}`);
      }

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        console.error('[competitor-ads] ScrapeCreators invalid JSON', rawBody.slice(0, 300));
        return { results: [], searchResultsCount: 0 };
      }

      const results = (Array.isArray(data.searchResults)
        ? data.searchResults
        : Array.isArray((data as { data?: { searchResults?: unknown[] } }).data?.searchResults)
          ? (data as { data: { searchResults: unknown[] } }).data.searchResults
          : []) as unknown[];

      const count = typeof data.searchResultsCount === 'number' ? data.searchResultsCount : undefined;
      const nextCursor = typeof data.cursor === 'string' && data.cursor ? data.cursor : undefined;
      console.log('[competitor-ads] ScrapeCreators response', { keyword, searchType, resultsLength: results.length, searchResultsCount: count, hasNextCursor: !!nextCursor });
      return { results, searchResultsCount: count, cursor: nextCursor };
    }

    async function fetchAllPages(searchType: 'keyword_exact_phrase' | 'keyword_unordered'): Promise<{ results: unknown[]; searchResultsCount?: number }> {
      const all: unknown[] = [];
      let cursor: string | undefined;
      let searchResultsCount: number | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const pageResult = await fetchScrapeCreators(searchType, cursor);
        const list = pageResult.results as unknown[];
        all.push(...list);
        if (typeof pageResult.searchResultsCount === 'number') searchResultsCount = pageResult.searchResultsCount;
        if (list.length === 0 || !pageResult.cursor || all.length >= TARGET_RESULTS) break;
        cursor = pageResult.cursor;
      }
      return { results: all, searchResultsCount };
    }

    let { results, searchResultsCount } = await fetchAllPages('keyword_exact_phrase');
    if (results.length === 0) {
      console.log('[competitor-ads] No results for exact phrase, trying keyword_unordered');
      const fallback = await fetchAllPages('keyword_unordered');
      results = fallback.results;
      searchResultsCount = fallback.searchResultsCount;
    }

    await supabase.from('competitor_ads_cache').insert({
      keyword,
      results,
    });

    return NextResponse.json({
      keyword,
      results,
      cached: false,
      searchResultsCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Competitor ads request failed';
    console.error('competitor-ads error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
