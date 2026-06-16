import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOwnerEmail } from '@/lib/subscription-limits';
import {
  addTeamMember,
  canManageTeam,
  listTeamMembers,
  removeTeamMember,
  resolveBillingEmail,
} from '@/lib/team-members';

export const dynamic = 'force-dynamic';

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.email) {
    return { error: NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 }) };
  }
  const email = user.email.trim().toLowerCase();
  return { email, user };
}

export async function GET() {
  const auth = await requireUser();
  if ('error' in auth && auth.error) return auth.error;
  const { email } = auth as { email: string };

  if (email === resolveOwnerEmail()) {
    return NextResponse.json({
      ok: true,
      can_manage: true,
      members: [],
      max_members: 50,
      is_team_member: false,
    });
  }

  const admin = createAdminClient();
  const billing = await resolveBillingEmail(admin, email);

  if (billing.isTeamMember) {
    return NextResponse.json({
      ok: true,
      can_manage: false,
      is_team_member: true,
      team_owner_email: billing.teamOwnerEmail,
      members: [],
    });
  }

  const manage = await canManageTeam(admin, email);
  if (!manage.ok) {
    return NextResponse.json({
      ok: true,
      can_manage: false,
      is_team_member: false,
      members: [],
      reason: manage.reason,
    });
  }

  const members = await listTeamMembers(admin, email);
  return NextResponse.json({
    ok: true,
    can_manage: true,
    is_team_member: false,
    members: members.map((m) => ({
      id: m.id,
      email: m.member_email,
      created_at: m.created_at,
    })),
    max_members: manage.maxMembers,
    plan: manage.plan,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ('error' in auth && auth.error) return auth.error;
  const { email } = auth as { email: string };

  if (email === resolveOwnerEmail()) {
    return NextResponse.json({ ok: false, error: 'Owner account uses unlimited access' }, { status: 400 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const memberEmail = typeof body.email === 'string' ? body.email : '';
  if (!memberEmail.trim()) {
    return NextResponse.json({ ok: false, error: 'Email is required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const billing = await resolveBillingEmail(admin, email);
  if (billing.isTeamMember) {
    return NextResponse.json(
      { ok: false, error: 'Only the account owner can invite team members' },
      { status: 403 }
    );
  }

  const result = await addTeamMember(admin, email, memberEmail);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  const manage = await canManageTeam(admin, email);
  const members = await listTeamMembers(admin, email);

  return NextResponse.json({
    ok: true,
    member: {
      id: result.member.id,
      email: result.member.member_email,
      created_at: result.member.created_at,
    },
    members: members.map((m) => ({
      id: m.id,
      email: m.member_email,
      created_at: m.created_at,
    })),
    max_members: manage.ok ? manage.maxMembers : 0,
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser();
  if ('error' in auth && auth.error) return auth.error;
  const { email } = auth as { email: string };

  const memberEmail = request.nextUrl.searchParams.get('email')?.trim() ?? '';
  if (!memberEmail) {
    return NextResponse.json({ ok: false, error: 'email query param required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const billing = await resolveBillingEmail(admin, email);
  if (billing.isTeamMember) {
    return NextResponse.json(
      { ok: false, error: 'Only the account owner can remove team members' },
      { status: 403 }
    );
  }

  const result = await removeTeamMember(admin, email, memberEmail);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  const members = await listTeamMembers(admin, email);
  return NextResponse.json({
    ok: true,
    members: members.map((m) => ({
      id: m.id,
      email: m.member_email,
      created_at: m.created_at,
    })),
  });
}
