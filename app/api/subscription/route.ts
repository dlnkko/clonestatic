import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.email) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const email = user.email.trim().toLowerCase();
  if (!email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Valid email required' }, { status: 400 });
  }

  const ownerEmailFromEnv = process.env.OWNER_EMAIL?.trim()?.toLowerCase();
  const ownerEmail =
    ownerEmailFromEnv && ownerEmailFromEnv.length > 0
      ? ownerEmailFromEnv
      : 'diegolinaresd10@gmail.com';
  const isOwner = email === ownerEmail;
  if (isOwner) {
    return NextResponse.json({
      ok: true,
      plan: 'owner',
      credits_remaining: 999999,
      period_end: null,
    });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('subscriptions')
      .select('plan, credits_remaining, period_end')
      .eq('email', email)
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: 'No subscription found' }, { status: 404 });
    }

    const credits = Math.max(0, data.credits_remaining ?? 0);
    return NextResponse.json({
      ok: true,
      plan: data.plan,
      credits_remaining: credits,
      period_end: data.period_end,
    });
  } catch (err) {
    console.error('GET /api/subscription:', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
