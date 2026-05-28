function formatUtcDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Rolling ads window: start = 1 calendar month before ref day.
 * end_date is today (display/cache only) — ScrapeCreators omits end_date so it defaults to query day.
 */
export function getAdsDateRange(ref: Date = new Date()): {
  start_date: string;
  end_date: string;
  periodKey: string;
  label: string;
} {
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 1);

  const start_date = formatUtcDate(start);
  const end_date = formatUtcDate(end);

  return {
    start_date,
    end_date,
    periodKey: end_date,
    label: `Since ${start_date}`,
  };
}

/** @deprecated Use getAdsDateRange */
export const getPreviousCalendarMonthRange = getAdsDateRange;
