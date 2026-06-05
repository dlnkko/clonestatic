/** Turn API / SDK error payloads into a user-visible string (never "[object Object]"). */
export function errorMessageFromUnknown(
  value: unknown,
  fallback = 'Something went wrong'
): string {
  if (value == null) return fallback;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value instanceof Error && value.message.trim()) return value.message.trim();

  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    for (const key of ['message', 'error', 'details', 'detail', 'description']) {
      const v = o[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (v && typeof v === 'object') {
        const nested = errorMessageFromUnknown(v, '');
        if (nested) return nested;
      }
    }
    try {
      const json = JSON.stringify(value);
      if (json && json !== '{}' && json.length < 500) return json;
    } catch {
      /* ignore */
    }
  }

  return fallback;
}

/** Read `{ error, details }` from a failed `fetch().json()` body (for logs / dev only). */
export function messageFromApiErrorBody(
  body: unknown,
  fallback = 'Request failed'
): string {
  if (!body || typeof body !== 'object') return fallback;
  const o = body as Record<string, unknown>;
  const parts: string[] = [];
  const err = errorMessageFromUnknown(o.error, '');
  const details = errorMessageFromUnknown(o.details, '');
  if (err) parts.push(err);
  if (details && details !== err) parts.push(details);
  return parts.length > 0 ? parts.join(' — ') : fallback;
}

/** Safe copy shown in the product UI — never expose Firecrawl, env, or stack traces. */
export const USER_MESSAGES = {
  tryAgain: 'Something went wrong. Please try again.',
  scrapeFailed:
    "We couldn't load that page. Check the URL and try again, or switch to Manual.",
  saveProductFailed: "Couldn't save the product. Please try again.",
  rateLimit: 'Too many attempts. Please wait a moment and try again.',
  sessionExpired: 'Your session expired. Sign in again and try again.',
  urlRequired: 'Enter a product page URL.',
  invalidUrl: 'Enter a valid product page URL (https://…).',
} as const;

export function userMessageForProductScrape(httpStatus: number): string {
  if (httpStatus === 401) return USER_MESSAGES.sessionExpired;
  if (httpStatus === 429) return USER_MESSAGES.rateLimit;
  if (httpStatus === 400) return USER_MESSAGES.urlRequired;
  if (httpStatus === 503) return USER_MESSAGES.scrapeFailed;
  return USER_MESSAGES.scrapeFailed;
}

export function userMessageForProductSave(httpStatus: number): string {
  if (httpStatus === 401) return USER_MESSAGES.sessionExpired;
  if (httpStatus === 429) return USER_MESSAGES.rateLimit;
  return USER_MESSAGES.saveProductFailed;
}
