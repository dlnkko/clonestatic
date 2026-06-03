import { getWhopClient, getWhopClientOrNull } from '@/lib/whop-sdk';

let cachedCompanyId: string | null = null;

export async function resolveWhopCompanyId(): Promise<string | null> {
  const fromEnv = process.env.WHOP_COMPANY_ID?.trim();
  if (fromEnv) return fromEnv;
  if (cachedCompanyId) return cachedCompanyId;

  const client = getWhopClientOrNull();
  if (!client) return null;

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
  return null;
}

function memberEmail(member: {
  user?: { email?: string | null } | null;
  email?: string | null;
}): string | null {
  const email = member.user?.email ?? member.email;
  return typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;
}

async function upsertFromWhopData(input: import('@/lib/whop-subscription').WhopSubscriptionInput) {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const { upsertWhopSubscription } = await import('@/lib/whop-subscription');
  const supabase = createAdminClient();
  return upsertWhopSubscription(supabase, input);
}

/** Pull active membership from Whop API when webhook is delayed or failed. */
export async function syncWhopSubscriptionForEmail(
  email: string
): Promise<{ ok: true; plan: string; credits: number } | { ok: false; error: string }> {
  const client = getWhopClientOrNull();
  if (!client) {
    return { ok: false, error: 'WHOP_API_KEY not configured' };
  }

  const companyId = await resolveWhopCompanyId();
  if (!companyId) {
    return {
      ok: false,
      error: 'WHOP_COMPANY_ID not configured and could not auto-detect company',
    };
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
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

        const { row, error } = await upsertFromWhopData({
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
      first: 50,
    })) {
      const payEmail = payment.user?.email?.trim().toLowerCase();
      if (payEmail !== normalizedEmail) continue;
      const planId = payment.plan?.id;
      if (!planId) continue;

      const { row, error } = await upsertFromWhopData({
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

    return { ok: false, error: 'No Whop membership or payment found for this email' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Whop sync failed';
    return { ok: false, error: message };
  }
}

/** Fetch payment/membership details when webhook payload omits email. */
export async function enrichWhopPayloadFromApi(
  body: Record<string, unknown>
): Promise<import('@/lib/whop-subscription').WhopSubscriptionInput | null> {
  const { parseWhopWebhookPayload } = await import('@/lib/whop-subscription');
  const parsed = parseWhopWebhookPayload(body);
  if (parsed?.email) return parsed;

  const client = getWhopClientOrNull();
  if (!client) return parsed;

  const data = (body.data ?? {}) as Record<string, unknown>;
  const id = typeof data.id === 'string' ? data.id : null;
  const paymentId = id?.startsWith('pay_') ? id : null;
  const membershipId = id?.startsWith('mem_') ? id : null;

  try {
    if (paymentId) {
      const payment = await client.payments.retrieve(paymentId);
      const payEmail = payment.user?.email?.trim().toLowerCase();
      if (payEmail) {
        return {
          email: payEmail,
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
      const memEmail = membership.user?.email?.trim().toLowerCase();
      if (memEmail) {
        return {
          email: memEmail,
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

/** Cancel a Whop membership via @whop/sdk. */
export async function cancelWhopMembership(
  membershipId: string,
  mode: WhopCancelMode = 'at_period_end'
): Promise<{ ok: true; cancelAtPeriodEnd: boolean } | { ok: false; error: string }> {
  try {
    const client = getWhopClient();
    const membership = await client.memberships.cancel(membershipId, {
      cancellation_mode: mode,
    });
    return {
      ok: true,
      cancelAtPeriodEnd: membership.cancel_at_period_end === true || mode === 'at_period_end',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Whop cancel failed';
    return { ok: false, error: message };
  }
}
