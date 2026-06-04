import { getWhopClient, getWhopClientOrNull } from '@/lib/whop-sdk';
import { paidPlanRank, resolveWhopPlanKey, type PaidPlanKey } from '@/lib/plans';
import type { WhopSubscriptionInput } from '@/lib/whop-subscription';
import type Whop from '@whop/sdk';

type MembershipStatus = NonNullable<
  Parameters<Whop['memberships']['list']>[0]
>['statuses'] extends Array<infer S> | null | undefined
  ? S
  : never;

const MEMBERSHIP_STATUS_PRIMARY: MembershipStatus[] = ['active', 'trialing', 'completed'];
const MEMBERSHIP_STATUS_EXTENDED: MembershipStatus[] = [
  'active',
  'trialing',
  'completed',
  'past_due',
  'drafted',
  'unresolved',
];

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

  const routeSlug = process.env.WHOP_COMPANY_ROUTE?.trim() || 'admirror';
  try {
    const company = await client.companies.retrieve(routeSlug);
    if (company.id?.startsWith('biz_')) {
      cachedCompanyId = company.id;
      return company.id;
    }
  } catch (err) {
    console.error('Whop companies.retrieve failed:', err);
  }

  return null;
}

type MembershipLike = {
  id?: string | null;
  user?: { id?: string | null; email?: string | null } | null;
  email?: string | null;
  plan?: { id?: string | null } | null;
  renewal_period_end?: string | null;
  renewal_period_start?: number | string | null;
  created_at?: number | string | null;
  cancel_at_period_end?: boolean | null;
};

function membershipEmail(membership: MembershipLike): string | null {
  const email = membership.user?.email ?? membership.email;
  return typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;
}

function memberEmail(member: {
  user?: { email?: string | null } | null;
  email?: string | null;
}): string | null {
  const email = member.user?.email ?? member.email;
  return typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;
}

function numericSortKey(value: number | string | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return asNumber;
    const asDate = Date.parse(value);
    if (Number.isFinite(asDate)) return asDate;
  }
  return 0;
}

function membershipSortKey(membership: MembershipLike): number {
  return numericSortKey(membership.created_at) || numericSortKey(membership.renewal_period_start);
}

function inputFromMembership(
  normalizedEmail: string,
  membership: MembershipLike
): WhopSubscriptionInput | null {
  const planId = membership.plan?.id;
  if (!planId) return null;

  return {
    email: normalizedEmail,
    planId,
    membershipId: membership.id ?? null,
    memberId: membership.user?.id ?? null,
    renewalPeriodEnd: membership.renewal_period_end ?? null,
    cancelAtPeriodEnd: membership.cancel_at_period_end === true,
  };
}

type MembershipCandidate = WhopSubscriptionInput & {
  planKey: PaidPlanKey;
  sortKey: number;
};

function pickBestMembership(candidates: MembershipCandidate[]): MembershipCandidate | null {
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const rankDiff = paidPlanRank(b.planKey) - paidPlanRank(a.planKey);
    if (rankDiff !== 0) return rankDiff;
    return b.sortKey - a.sortKey;
  });

  return candidates[0];
}

function addMembershipCandidate(
  candidates: MembershipCandidate[],
  seenMembershipIds: Set<string>,
  normalizedEmail: string,
  membership: MembershipLike
) {
  const email = membershipEmail(membership);
  if (email !== normalizedEmail) return;

  const planId = membership.plan?.id;
  const membershipId = membership.id;
  if (!planId || !membershipId || seenMembershipIds.has(membershipId)) return;

  seenMembershipIds.add(membershipId);
  const input = inputFromMembership(normalizedEmail, membership);
  if (!input) return;

  candidates.push({
    ...input,
    planKey: resolveWhopPlanKey(planId),
    sortKey: membershipSortKey(membership),
  });
}

async function upsertFromWhopData(input: WhopSubscriptionInput) {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const { upsertWhopSubscription } = await import('@/lib/whop-subscription');
  const supabase = createAdminClient();
  return upsertWhopSubscription(supabase, input, { grantFreshCredits: true });
}

function inputFromWhopPayment(
  sessionEmail: string,
  payment: {
    plan?: { id?: string | null } | null;
    membership?: { id?: string | null } | null;
    user?: { id?: string | null; email?: string | null } | null;
    status?: unknown;
  },
  options?: { skipStatusCheck?: boolean }
): WhopSubscriptionInput | null {
  if (!options?.skipStatusCheck && !isSuccessfulPaymentStatus(payment.status)) return null;

  const planId = payment.plan?.id;
  if (!planId) return null;

  const payEmail = payment.user?.email?.trim().toLowerCase();
  const normalizedSession = sessionEmail.trim().toLowerCase();
  if (payEmail && payEmail !== normalizedSession) {
    console.warn('Whop payment email mismatch:', payEmail, 'session=', normalizedSession);
  }

  return {
    email: normalizedSession,
    planId,
    membershipId: payment.membership?.id ?? null,
    memberId: payment.user?.id ?? null,
    renewalPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };
}

/** Activate subscription directly from a Whop payment id (post-checkout redirect). */
export async function activateWhopSubscriptionFromPaymentId(
  paymentId: string,
  sessionEmail: string
): Promise<WhopSyncResult> {
  const client = getWhopClientOrNull();
  if (!client) {
    return { ok: false, error: 'WHOP_API_KEY not configured' };
  }

  const normalizedId = paymentId.trim();
  if (!normalizedId.startsWith('pay_')) {
    return { ok: false, error: 'Invalid payment id' };
  }

  try {
    const payment = await client.payments.retrieve(normalizedId);
    const input = inputFromWhopPayment(sessionEmail, payment, { skipStatusCheck: true });
    if (!input) {
      return { ok: false, error: 'Payment not successful or missing plan' };
    }

    const { row, error } = await upsertFromWhopData(input);
    if (error) return { ok: false, error: error.message };
    return { ok: true, plan: row.plan, credits: row.credits_remaining };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Whop payment retrieve failed';
    return { ok: false, error: message };
  }
}

async function listMembershipsForEmail(
  normalizedEmail: string,
  companyId: string,
  statuses: MembershipStatus[] | undefined,
  candidates: MembershipCandidate[],
  seenMembershipIds: Set<string>
) {
  const client = getWhopClientOrNull();
  if (!client) return;

  const params: { company_id: string; first: number; statuses?: MembershipStatus[] } = {
    company_id: companyId,
    first: 200,
  };
  if (statuses) params.statuses = statuses;

  try {
    for await (const membership of client.memberships.list(params)) {
      addMembershipCandidate(candidates, seenMembershipIds, normalizedEmail, membership);
    }
  } catch (err) {
    console.error('Whop memberships.list failed:', err);
  }
}

async function gatherMembershipCandidates(
  normalizedEmail: string,
  companyId: string
): Promise<MembershipCandidate[]> {
  const client = getWhopClientOrNull();
  if (!client) return [];

  const candidates: MembershipCandidate[] = [];
  const seenMembershipIds = new Set<string>();

  await listMembershipsForEmail(
    normalizedEmail,
    companyId,
    MEMBERSHIP_STATUS_PRIMARY,
    candidates,
    seenMembershipIds
  );

  if (candidates.length === 0) {
    await listMembershipsForEmail(
      normalizedEmail,
      companyId,
      MEMBERSHIP_STATUS_EXTENDED,
      candidates,
      seenMembershipIds
    );
  }

  try {
    for await (const member of client.members.list({
      company_id: companyId,
      query: normalizedEmail,
      first: 50,
    })) {
      if (memberEmail(member) !== normalizedEmail) continue;
      const userId = member.user?.id;
      if (!userId) continue;

      for await (const membership of client.memberships.list({
        company_id: companyId,
        user_ids: [userId],
        first: 50,
      })) {
        addMembershipCandidate(candidates, seenMembershipIds, normalizedEmail, membership);
      }
    }
  } catch (err) {
    console.error('Whop members.list failed:', err);
  }

  return candidates;
}

const PAYMENT_SUCCESS_PATTERN = /success|complete|paid|succeed/i;

function isSuccessfulPaymentStatus(status: unknown): boolean {
  if (status == null || status === '') return true;
  const normalized = String(status).toLowerCase();
  if (normalized === 'failed' || normalized === 'canceled' || normalized === 'cancelled') {
    return false;
  }
  return PAYMENT_SUCCESS_PATTERN.test(normalized);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findPaymentForEmail(
  normalizedEmail: string,
  companyId: string
): Promise<WhopSubscriptionInput | null> {
  const client = getWhopClientOrNull();
  if (!client) return null;

  try {
    for await (const payment of client.payments.list({ company_id: companyId })) {
      const payEmail = payment.user?.email?.trim().toLowerCase();
      if (payEmail !== normalizedEmail) continue;
      if (!isSuccessfulPaymentStatus(payment.status)) continue;

      const planId = payment.plan?.id;
      if (!planId) continue;

      return {
        email: normalizedEmail,
        planId,
        membershipId: payment.membership?.id ?? null,
        memberId: payment.user?.id ?? null,
        renewalPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }
  } catch (err) {
    console.error('Whop payments.list failed:', err);
  }

  return null;
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
    const candidates = await gatherMembershipCandidates(normalizedEmail, companyId);
    const best = pickBestMembership(candidates);

    if (best) {
      const { row, error } = await upsertFromWhopData(best);
      if (error) return { ok: false, error: error.message };
      return { ok: true, plan: row.plan, credits: row.credits_remaining };
    }

    const paymentInput = await findPaymentForEmail(normalizedEmail, companyId);
    if (paymentInput) {
      const { row, error } = await upsertFromWhopData(paymentInput);
      if (error) return { ok: false, error: error.message };
      return { ok: true, plan: row.plan, credits: row.credits_remaining };
    }

    return { ok: false, error: 'No Whop membership or payment found for this email' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Whop sync failed';
    return { ok: false, error: message };
  }
}

export type WhopSyncResult =
  | { ok: true; plan: string; credits: number }
  | { ok: false; error: string };

/** Retry Whop sync — useful right after checkout when membership may not be indexed yet. */
export async function syncWhopSubscriptionForEmailWithRetries(
  email: string,
  options?: { maxAttempts?: number; delayMs?: number }
): Promise<WhopSyncResult> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 1);
  const delayMs = options?.delayMs ?? 2000;

  let lastResult: WhopSyncResult = { ok: false, error: 'Sync not attempted' };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    lastResult = await syncWhopSubscriptionForEmail(email);
    if (lastResult.ok) return lastResult;
    if (attempt < maxAttempts - 1) {
      await sleep(delayMs);
    }
  }

  return lastResult;
}

/** Fetch payment/membership details when webhook payload omits email. */
export async function enrichWhopPayloadFromApi(
  body: Record<string, unknown>
): Promise<WhopSubscriptionInput | null> {
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
      const memEmail = membershipEmail(membership);
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
