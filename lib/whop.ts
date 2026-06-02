import { getWhopClient } from '@/lib/whop-sdk';

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

let cachedCompanyId: string | null = null;

async function resolveWhopCompanyId(): Promise<string | null> {
  const fromEnv = process.env.WHOP_COMPANY_ID?.trim();
  if (fromEnv) return fromEnv;
  if (cachedCompanyId) return cachedCompanyId;

  const client = getWhopClient();
  if (client) {
    try {
      for await (const company of client.companies.list({ first: 1 })) {
        if (company.id?.startsWith('biz_')) {
          cachedCompanyId = company.id;
          return company.id;
        }
      }
    } catch (err) {
      console.error('Whop companies.list failed:', err);
    }
  }

  try {
    const res = await fetch(`${WHOP_API_BASE}/companies?first=1`, { headers: whopHeaders() });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { id?: string }[] };
    const id = body.data?.[0]?.id;
    if (id?.startsWith('biz_')) {
      cachedCompanyId = id;
      return id;
    }
  } catch (err) {
    console.error('Whop companies fetch failed:', err);
  }

  return null;
}

type WhopListResponse<T> = {
  data?: T[];
};

function memberEmail(member: {
  user?: { email?: string | null } | null;
  email?: string | null;
}): string | null {
  const email = member.user?.email ?? member.email;
  return typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;
}

/** Pull active membership from Whop API when webhook is delayed or failed. */
export async function syncWhopSubscriptionForEmail(
  email: string
): Promise<{ ok: true; plan: string; credits: number } | { ok: false; error: string }> {
  const companyId = await resolveWhopCompanyId();
  if (!companyId) {
    return {
      ok: false,
      error: 'WHOP_COMPANY_ID not configured and could not auto-detect company',
    };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const client = getWhopClient();

  try {
    if (client) {
      for await (const member of client.members.list({
        company_id: companyId,
        query: normalizedEmail,
        first: 10,
      })) {
        if (memberEmail(member) !== normalizedEmail) continue;
        const userId = member.user?.id;
        if (!userId) continue;

        for await (const membership of client.memberships.list({
          company_id: companyId,
          user_ids: [userId],
          statuses: ['active', 'trialing', 'completed'],
          first: 5,
        })) {
          const planId = membership.plan?.id;
          if (!planId) continue;

          const { createAdminClient } = await import('@/lib/supabase/admin');
          const { upsertWhopSubscription } = await import('@/lib/whop-subscription');
          const supabase = createAdminClient();
          const { row, error } = await upsertWhopSubscription(supabase, {
            email: normalizedEmail,
            planId,
            membershipId: membership.id ?? null,
            memberId: membership.user?.id ?? userId,
            renewalPeriodEnd: membership.renewal_period_end ?? null,
            cancelAtPeriodEnd: membership.cancel_at_period_end === true,
          });
          if (error) return { ok: false, error: error.message };
          return { ok: true, plan: row.plan, credits: row.credits_remaining };
        }
      }

      for await (const payment of client.payments.list({
        company_id: companyId,
        first: 20,
      })) {
        const payEmail = payment.user?.email?.trim().toLowerCase();
        if (payEmail !== normalizedEmail) continue;
        const planId = payment.plan?.id;
        if (!planId) continue;

        const { createAdminClient } = await import('@/lib/supabase/admin');
        const { upsertWhopSubscription } = await import('@/lib/whop-subscription');
        const supabase = createAdminClient();
        const { row, error } = await upsertWhopSubscription(supabase, {
          email: normalizedEmail,
          planId,
          membershipId: payment.membership?.id ?? null,
          memberId: payment.user?.id ?? null,
          renewalPeriodEnd: null,
          cancelAtPeriodEnd: false,
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, plan: row.plan, credits: row.credits_remaining };
      }
    }

    const memberQuery = new URLSearchParams({ company_id: companyId, query: normalizedEmail });
    const membersRes = await fetch(`${WHOP_API_BASE}/members?${memberQuery}`, {
      headers: whopHeaders(),
    });
    if (!membersRes.ok) {
      return { ok: false, error: `Whop members lookup failed (${membersRes.status})` };
    }
    const membersBody = (await membersRes.json()) as WhopListResponse<{
      user?: { id?: string; email?: string };
      email?: string;
    }>;
    const members = membersBody.data ?? [];
    const member = members.find((m) => memberEmail(m) === normalizedEmail);
    const userId = member?.user?.id;
    if (!userId) {
      return { ok: false, error: 'No Whop member found for this email' };
    }

    const membershipUrl =
      `${WHOP_API_BASE}/memberships?company_id=${encodeURIComponent(companyId)}` +
      `&user_ids[]=${encodeURIComponent(userId)}` +
      `&statuses[]=active&statuses[]=trialing&statuses[]=completed`;

    const membershipsRes = await fetch(membershipUrl, { headers: whopHeaders() });
    if (!membershipsRes.ok) {
      return { ok: false, error: `Whop memberships lookup failed (${membershipsRes.status})` };
    }
    const membershipsBody = (await membershipsRes.json()) as WhopListResponse<{
      id?: string;
      plan?: { id?: string };
      user?: { id?: string; email?: string };
      renewal_period_end?: string | null;
      cancel_at_period_end?: boolean;
    }>;
    const active = membershipsBody.data?.[0];
    if (!active?.plan?.id) {
      return { ok: false, error: 'No active Whop membership found' };
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const { upsertWhopSubscription } = await import('@/lib/whop-subscription');
    const supabase = createAdminClient();
    const { row, error } = await upsertWhopSubscription(supabase, {
      email: normalizedEmail,
      planId: active.plan.id,
      membershipId: active.id ?? null,
      memberId: active.user?.id ?? userId,
      renewalPeriodEnd: active.renewal_period_end ?? null,
      cancelAtPeriodEnd: active.cancel_at_period_end === true,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, plan: row.plan, credits: row.credits_remaining };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Whop sync failed';
    return { ok: false, error: message };
  }
}

/** Fetch payment/membership details when webhook payload omits email (missing scopes). */
export async function enrichWhopPayloadFromApi(
  body: Record<string, unknown>
): Promise<import('@/lib/whop-subscription').WhopSubscriptionInput | null> {
  const { parseWhopWebhookPayload } = await import('@/lib/whop-subscription');
  const parsed = parseWhopWebhookPayload(body);
  if (parsed?.email) return parsed;

  const client = getWhopClient();
  if (!client) return parsed;

  const data = (body.data ?? {}) as Record<string, unknown>;
  const paymentId = typeof data.id === 'string' && data.id.startsWith('pay_') ? data.id : null;
  const membershipId =
    typeof data.id === 'string' && data.id.startsWith('mem_') ? data.id : null;

  try {
    if (paymentId) {
      const payment = await client.payments.retrieve(paymentId);
      const email = payment.user?.email?.trim().toLowerCase();
      if (email) {
        return {
          email,
          planId: payment.plan?.id,
          membershipId: payment.membership?.id ?? null,
          memberId: payment.user?.id ?? null,
          renewalPeriodEnd: null,
          cancelAtPeriodEnd: false,
        };
      }
    }
    if (membershipId) {
      const membership = await client.memberships.retrieve(membershipId);
      const email = membership.user?.email?.trim().toLowerCase();
      if (email) {
        return {
          email,
          planId: membership.plan?.id,
          membershipId: membership.id,
          memberId: membership.user?.id ?? null,
          renewalPeriodEnd: membership.renewal_period_end ?? null,
          cancelAtPeriodEnd: membership.cancel_at_period_end === true,
        };
      }
    }
  } catch (err) {
    console.error('Whop enrichWhopPayloadFromApi failed:', err);
  }

  return parsed;
}

export type WhopCancelMode = 'at_period_end' | 'immediate';

/** Cancel a Whop membership via REST API. */
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
