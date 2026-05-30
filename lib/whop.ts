const WHOP_API_BASE = 'https://api.whop.com/api/v1';

function whopHeaders(): HeadersInit {
  const apiKey = process.env.WHOP_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('WHOP_API_KEY is not configured');
  }
  const token = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
  return {
    Authorization: token,
    'Content-Type': 'application/json',
  };
}

export type WhopCancelMode = 'at_period_end' | 'immediate';

/** Cancel a Whop membership via REST API (docs.whop.com/api-reference/memberships/cancel-membership). */
export async function cancelWhopMembership(
  membershipId: string,
  mode: WhopCancelMode = 'at_period_end'
): Promise<{ ok: true; cancelAtPeriodEnd: boolean } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${WHOP_API_BASE}/memberships/${encodeURIComponent(membershipId)}/cancel`, {
      method: 'POST',
      headers: whopHeaders(),
      body: JSON.stringify({ cancellation_mode: mode }),
    });

    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      /* ignore */
    }

    if (!res.ok) {
      const msg =
        (typeof body.message === 'string' && body.message) ||
        (typeof body.error === 'string' && body.error) ||
        `Whop API error (${res.status})`;
      return { ok: false, error: msg };
    }

    const cancelAtPeriodEnd =
      body.cancel_at_period_end === true || mode === 'at_period_end';
    return { ok: true, cancelAtPeriodEnd };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Whop request failed';
    return { ok: false, error: message };
  }
}
