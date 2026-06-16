import type { SupabaseClient } from '@supabase/supabase-js';
import {
  creditsForPlan,
  isOneTimePlan,
  isOneTimeWhopPlanId,
  isPaidPlan,
  isYearlyWhopPlanId,
  resolveWhopPlanKey,
  type BillingPlanKey,
} from '@/lib/plans';

export type WhopSubscriptionInput = {
  email: string;
  planId?: string;
  membershipId?: string | null;
  memberId?: string | null;
  renewalPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  /** Whop pay_xxx — used to avoid crediting the same one-time purchase twice */
  paymentId?: string | null;
};

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readEmail(value: unknown): string | null {
  const email = readString(value);
  return email && email.includes('@') ? email.toLowerCase() : null;
}

function findEmailDeep(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) return null;
  if (typeof value === 'string' && value.includes('@')) {
    return readEmail(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findEmailDeep(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.email) {
      const direct = readEmail(obj.email);
      if (direct) return direct;
    }
    if (obj.user) {
      const fromUser = findEmailDeep(obj.user, depth + 1);
      if (fromUser) return fromUser;
    }
    for (const key of ['data', 'member', 'membership', 'payment', 'object']) {
      if (key in obj) {
        const found = findEmailDeep(obj[key], depth + 1);
        if (found) return found;
      }
    }
  }
  return null;
}

/** Extract subscription fields from any Whop webhook payload shape. */
export function parseWhopWebhookPayload(body: Record<string, unknown>): WhopSubscriptionInput | null {
  const data = (body.data ?? body.object ?? body) as Record<string, unknown>;

  const user = (data.user ?? data.member) as Record<string, unknown> | undefined;
  const membership = data.membership as Record<string, unknown> | undefined;
  const plan = (data.plan ?? membership?.plan) as Record<string, unknown> | undefined;

  const email =
    readEmail(user?.email) ??
    readEmail(data.email) ??
    readEmail(body.email) ??
    readEmail((body.member as Record<string, unknown> | undefined)?.email) ??
    findEmailDeep(body);

  if (!email) return null;

  const planId =
    readString(plan?.id) ??
    readString(data.plan_id) ??
    readString(membership?.plan_id) ??
    undefined;

  let membershipId =
    readString(membership?.id) ??
    readString(data.membership_id) ??
    null;
  if (membershipId && !membershipId.startsWith('mem_')) {
    membershipId = null;
  }

  const memberId = readString(user?.id) ?? readString(data.member_id);

  const rawId = readString(data.id);
  const paymentId =
    (rawId?.startsWith('pay_') ? rawId : null) ??
    readString(data.payment_id) ??
    readString((data.payment as Record<string, unknown> | undefined)?.id);

  const renewalPeriodEnd =
    readString(data.renewal_period_end) ??
    readString(membership?.renewal_period_end) ??
    null;

  const cancelAtPeriodEnd =
    data.cancel_at_period_end === true ||
    membership?.cancel_at_period_end === true;

  return {
    email,
    planId,
    membershipId: membershipId?.startsWith('mem_') ? membershipId : null,
    memberId,
    renewalPeriodEnd,
    cancelAtPeriodEnd,
    paymentId,
  };
}

export function normalizeWhopEvent(body: Record<string, unknown>): string {
  return String(body.action ?? body.event ?? body.type ?? '').toLowerCase();
}

export function periodEndFromWhop(planId: string | undefined, renewalPeriodEnd?: string | null): string | null {
  if (planId && isOneTimeWhopPlanId(planId)) return null;

  if (renewalPeriodEnd) {
    const d = new Date(renewalPeriodEnd);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  const end = new Date();
  if (planId && isYearlyWhopPlanId(planId)) {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end.toISOString().slice(0, 10);
}

export function subscriptionRowFromWhop(input: WhopSubscriptionInput) {
  const plan: BillingPlanKey = resolveWhopPlanKey(input.planId);
  const credits = creditsForPlan(plan);
  const oneTime = isOneTimePlan(plan);

  return {
    email: input.email,
    plan,
    credits_remaining: credits,
    period_end: periodEndFromWhop(input.planId, input.renewalPeriodEnd),
    whop_member_id: input.memberId ?? null,
    whop_membership_id: oneTime ? null : input.membershipId ?? null,
    cancel_at_period_end: oneTime ? false : input.cancelAtPeriodEnd === true,
    updated_at: new Date().toISOString(),
  };
}

export type UpsertWhopSubscriptionOptions = {
  /**
   * true = payment / new checkout / manual sync → grant credits for the plan.
   * false = metadata-only webhook (e.g. cancel flag) → keep current credit balance.
   */
  grantFreshCredits?: boolean;
  /** When true, one-time pack purchases stack credits (+10). Use on payment webhooks only. */
  incrementOneTimeCredits?: boolean;
};

export async function upsertWhopSubscription(
  supabase: SupabaseClient,
  input: WhopSubscriptionInput,
  options: UpsertWhopSubscriptionOptions = {}
) {
  const grantFreshCredits = options.grantFreshCredits !== false;
  const incrementOneTimeCredits = options.incrementOneTimeCredits === true;
  const planKey = resolveWhopPlanKey(input.planId);
  const row = subscriptionRowFromWhop(input);

  const { data: existing } = await supabase
    .from('subscriptions')
    .select(
      'credits_remaining, plan, period_end, whop_membership_id, cancel_at_period_end, last_credited_payment_id'
    )
    .eq('email', input.email)
    .maybeSingle();

  const paymentId = input.paymentId?.trim() || null;

  if (isOneTimePlan(planKey) && grantFreshCredits) {
    const addCredits = creditsForPlan(planKey);
    const alreadyCredited =
      paymentId &&
      existing?.last_credited_payment_id &&
      existing.last_credited_payment_id === paymentId;

    if (alreadyCredited) {
      row.credits_remaining = Math.max(0, existing?.credits_remaining ?? 0);
    } else if (incrementOneTimeCredits) {
      row.credits_remaining = Math.max(0, existing?.credits_remaining ?? 0) + addCredits;
      if (paymentId) {
        (row as Record<string, unknown>).last_credited_payment_id = paymentId;
      }
    } else if (existing) {
      row.credits_remaining = Math.max(0, existing.credits_remaining ?? 0);
    }
    if (existing?.plan && isPaidPlan(existing.plan)) {
      row.plan = existing.plan;
      row.period_end = existing.period_end ?? row.period_end;
      row.whop_membership_id = existing.whop_membership_id ?? row.whop_membership_id;
      row.cancel_at_period_end = existing.cancel_at_period_end === true;
    }
  } else if (!grantFreshCredits && existing) {
    row.credits_remaining = Math.max(0, existing.credits_remaining ?? 0);
    if (existing.plan && isPaidPlan(existing.plan) && isOneTimePlan(planKey)) {
      row.plan = existing.plan;
    }
  }

  const { error } = await supabase.from('subscriptions').upsert(row, { onConflict: 'email' });
  return { row, error };
}
