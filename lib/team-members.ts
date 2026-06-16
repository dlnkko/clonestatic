import type { SupabaseClient } from '@supabase/supabase-js';
import {
  creditsForPlan,
  isEntitledPlan,
  isPaidPlan,
  type BillingPlanKey,
  type PaidPlanKey,
} from '@/lib/plans';

export type TeamMemberRecord = {
  id: string;
  owner_email: string;
  member_email: string;
  created_at: string;
};

const MAX_TEAM_MEMBERS: Record<BillingPlanKey, number> = {
  pack_10: 2,
  standard: 3,
  pro: 5,
  scale: 15,
};

export function maxTeamMembersForPlan(plan: string | null | undefined): number {
  if (plan === 'owner') return 50;
  if (plan && plan in MAX_TEAM_MEMBERS) {
    return MAX_TEAM_MEMBERS[plan as BillingPlanKey];
  }
  return 0;
}

export function normalizeTeamEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidTeamEmail(email: string): boolean {
  const n = normalizeTeamEmail(email);
  return n.includes('@') && n.length >= 5 && n.length <= 254;
}

export async function getTeamOwnerForMember(
  admin: SupabaseClient,
  memberEmail: string
): Promise<string | null> {
  const email = normalizeTeamEmail(memberEmail);
  const { data, error } = await admin
    .from('team_members')
    .select('owner_email')
    .eq('member_email', email)
    .maybeSingle();

  if (error) {
    console.error('getTeamOwnerForMember:', error);
    return null;
  }
  return data?.owner_email ? normalizeTeamEmail(data.owner_email) : null;
}

export async function resolveBillingEmail(
  admin: SupabaseClient,
  userEmail: string
): Promise<{
  billingEmail: string;
  isTeamMember: boolean;
  teamOwnerEmail: string | null;
}> {
  const email = normalizeTeamEmail(userEmail);
  const teamOwnerEmail = await getTeamOwnerForMember(admin, email);
  if (teamOwnerEmail) {
    return { billingEmail: teamOwnerEmail, isTeamMember: true, teamOwnerEmail };
  }
  return { billingEmail: email, isTeamMember: false, teamOwnerEmail: null };
}

export async function listTeamMembers(
  admin: SupabaseClient,
  ownerEmail: string
): Promise<TeamMemberRecord[]> {
  const { data, error } = await admin
    .from('team_members')
    .select('id, owner_email, member_email, created_at')
    .eq('owner_email', normalizeTeamEmail(ownerEmail))
    .order('created_at', { ascending: true });

  if (error) {
    console.error('listTeamMembers:', error);
    return [];
  }
  return (data ?? []) as TeamMemberRecord[];
}

export async function canManageTeam(
  admin: SupabaseClient,
  ownerEmail: string
): Promise<{ ok: true; plan: BillingPlanKey; maxMembers: number } | { ok: false; reason: string }> {
  const email = normalizeTeamEmail(ownerEmail);
  const { data: sub } = await admin
    .from('subscriptions')
    .select('plan')
    .eq('email', email)
    .maybeSingle();

  if (!sub?.plan || !isEntitledPlan(sub.plan)) {
    return { ok: false, reason: 'Active plan required to invite team members' };
  }

  const plan = sub.plan as BillingPlanKey;
  const maxMembers = maxTeamMembersForPlan(plan);
  if (maxMembers < 1) {
    return { ok: false, reason: 'Your plan does not include team seats' };
  }

  return { ok: true, plan, maxMembers };
}

export async function addTeamMember(
  admin: SupabaseClient,
  ownerEmail: string,
  memberEmailRaw: string
): Promise<{ ok: true; member: TeamMemberRecord } | { ok: false; error: string; status: number }> {
  const owner = normalizeTeamEmail(ownerEmail);
  const member = normalizeTeamEmail(memberEmailRaw);

  if (!isValidTeamEmail(member)) {
    return { ok: false, error: 'Enter a valid email address', status: 400 };
  }
  if (member === owner) {
    return { ok: false, error: 'You cannot invite yourself', status: 400 };
  }

  const manage = await canManageTeam(admin, owner);
  if (!manage.ok) {
    return { ok: false, error: manage.reason, status: 403 };
  }

  const existing = await listTeamMembers(admin, owner);
  if (existing.length >= manage.maxMembers) {
    return {
      ok: false,
      error: `Team limit reached (${manage.maxMembers} members on your plan)`,
      status: 403,
    };
  }

  const { data: memberSub } = await admin
    .from('subscriptions')
    .select('plan')
    .eq('email', member)
    .maybeSingle();

  if (memberSub?.plan && isEntitledPlan(memberSub.plan) && isPaidPlan(memberSub.plan)) {
    return {
      ok: false,
      error: 'That email already has its own paid subscription',
      status: 409,
    };
  }

  const { data: onOtherTeam } = await admin
    .from('team_members')
    .select('owner_email')
    .eq('member_email', member)
    .maybeSingle();

  if (onOtherTeam && normalizeTeamEmail(onOtherTeam.owner_email) !== owner) {
    return {
      ok: false,
      error: 'That email is already on another team',
      status: 409,
    };
  }

  const { data, error } = await admin
    .from('team_members')
    .upsert(
      { owner_email: owner, member_email: member },
      { onConflict: 'member_email' }
    )
    .select('id, owner_email, member_email, created_at')
    .single();

  if (error || !data) {
    console.error('addTeamMember:', error);
    return { ok: false, error: 'Could not add team member', status: 500 };
  }

  return { ok: true, member: data as TeamMemberRecord };
}

export async function removeTeamMember(
  admin: SupabaseClient,
  ownerEmail: string,
  memberEmailRaw: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const owner = normalizeTeamEmail(ownerEmail);
  const member = normalizeTeamEmail(memberEmailRaw);

  const { error, count } = await admin
    .from('team_members')
    .delete({ count: 'exact' })
    .eq('owner_email', owner)
    .eq('member_email', member);

  if (error) {
    console.error('removeTeamMember:', error);
    return { ok: false, error: 'Could not remove team member', status: 500 };
  }
  if (!count) {
    return { ok: false, error: 'Team member not found', status: 404 };
  }
  return { ok: true };
}

/** For display in admin — credits pool size from plan definition */
export function planCreditsLabel(plan: string): string {
  if (plan === 'owner') return 'Unlimited';
  if (isEntitledPlan(plan)) {
    return String(creditsForPlan(plan));
  }
  return '—';
}

export function isPaidPlanKey(plan: string): plan is PaidPlanKey {
  return isPaidPlan(plan);
}
