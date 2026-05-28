import { getAdsDateRange } from '@/lib/competitors/dates';
import { fetchCompanyAds } from '@/lib/competitors/scrape-creators';

export type CompanyProbeStatus =
  | 'ok'
  | 'page_id_not_found'
  | 'zero_ads'
  | 'api_error';

export type CompanyProbeResult = {
  status: CompanyProbeStatus;
  adCount: number;
  samplePageName: string | null;
  errorMessage?: string;
};

export async function probeCompanyPage(companyName: string): Promise<CompanyProbeResult> {
  const dates = getAdsDateRange();
  try {
    const page = await fetchCompanyAds(companyName, dates);
    const results = page.results ?? [];
    const first = results[0] as { page_name?: string } | undefined;
    if (results.length === 0) {
      return { status: 'zero_ads', adCount: 0, samplePageName: null };
    }
    return {
      status: 'ok',
      adCount: results.length,
      samplePageName: first?.page_name?.trim() ?? null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/No pageId found/i.test(message)) {
      return {
        status: 'page_id_not_found',
        adCount: 0,
        samplePageName: null,
        errorMessage: message,
      };
    }
    return {
      status: 'api_error',
      adCount: 0,
      samplePageName: null,
      errorMessage: message,
    };
  }
}
