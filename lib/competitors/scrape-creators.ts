const BASE = 'https://api.scrapecreators.com/v1/facebook/adLibrary';

export type ScrapeCreatorsDateRange = {
  start_date: string;
};

function getApiKey(): string {
  const key = process.env.SCRAPECREATORS_API_KEY?.trim();
  if (!key) throw new Error('SCRAPECREATORS_API_KEY is not set. Add it to .env.local');
  return key;
}

/** Keyword search uses `searchResults`; company/ads uses `results`. */
function parseAdResults(data: Record<string, unknown>): unknown[] {
  if (Array.isArray(data.results) && data.results.length > 0) {
    return data.results;
  }
  if (Array.isArray(data.searchResults) && data.searchResults.length > 0) {
    return data.searchResults;
  }
  const nested = data.data as { results?: unknown[]; searchResults?: unknown[] } | undefined;
  if (Array.isArray(nested?.results) && nested.results.length > 0) {
    return nested.results;
  }
  if (Array.isArray(nested?.searchResults) && nested.searchResults.length > 0) {
    return nested.searchResults;
  }
  return [];
}

function isRetryableFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  const cause = (err as Error & { cause?: { code?: string } }).cause;
  const code = cause?.code?.toLowerCase() ?? '';
  return (
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    code === 'econnreset' ||
    code === 'etimedout' ||
    code === 'econnrefused'
  );
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastErr = err;
      if (!isRetryableFetchError(err) || i === attempts - 1) throw err;
      const delayMs = 800 * (i + 1);
      console.warn(`[scrape-creators] fetch retry ${i + 1}/${attempts - 1} in ${delayMs}ms`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

async function scrapeCreatorsGet(path: string, params: Record<string, string>): Promise<{
  results: unknown[];
  searchResultsCount?: number;
  cursor?: string;
  rawKeys?: string[];
}> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetchWithRetry(url.toString(), {
    headers: { 'x-api-key': getApiKey() },
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`ScrapeCreators ${res.status}: ${raw.slice(0, 200)}`);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { results: [] };
  }

  const results = parseAdResults(data);
  const searchResultsCount =
    typeof data.searchResultsCount === 'number'
      ? data.searchResultsCount
      : typeof data.resultsCount === 'number'
        ? data.resultsCount
        : undefined;
  const cursor = typeof data.cursor === 'string' && data.cursor ? data.cursor : undefined;

  return {
    results,
    searchResultsCount,
    cursor,
    rawKeys: Object.keys(data),
  };
}

const AD_PARAMS = {
  country: 'US',
  status: 'ACTIVE',
  media_type: 'MEME',
  sort_by: 'total_impressions',
  trim: 'true',
} as const;

/** Official Facebook page name for Meta Ad Library company lookup. */
export async function fetchCompanyAds(
  companyName: string,
  dates: ScrapeCreatorsDateRange,
  cursor?: string
): Promise<{ results: unknown[]; cursor?: string }> {
  const page = await scrapeCreatorsGet('/company/ads', {
    companyName,
    ...AD_PARAMS,
    start_date: dates.start_date,
    ...(cursor ? { cursor } : {}),
  });
  return { results: page.results, cursor: page.cursor };
}

export async function fetchCompanyAdsAll(
  companyName: string,
  dates: ScrapeCreatorsDateRange,
  maxPages = 3
): Promise<unknown[]> {
  const all: unknown[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchCompanyAds(companyName, dates, cursor);
    all.push(...page.results);
    if (!page.cursor || page.results.length === 0) break;
    cursor = page.cursor;
  }
  return all;
}

export async function fetchKeywordAds(
  query: string,
  dates: ScrapeCreatorsDateRange,
  cursor?: string
): Promise<{ results: unknown[]; cursor?: string }> {
  const page = await scrapeCreatorsGet('/search/ads', {
    query,
    search_type: 'keyword_exact_phrase',
    ad_type: 'all',
    ...AD_PARAMS,
    start_date: dates.start_date,
    ...(cursor ? { cursor } : {}),
  });
  return { results: page.results, cursor: page.cursor };
}

export async function fetchKeywordAdsAll(
  query: string,
  dates: ScrapeCreatorsDateRange,
  maxPages = 2
): Promise<unknown[]> {
  const all: unknown[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchKeywordAds(query, dates, cursor);
    all.push(...page.results);
    if (!page.cursor || page.results.length === 0) break;
    cursor = page.cursor;
  }
  return all;
}
