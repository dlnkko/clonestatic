import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOwnerEmail } from '@/lib/subscription-limits';
import { useCreditForGeneration } from '@/lib/creations/use-credit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.email) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const email = user.email.trim().toLowerCase();
  if (!email.includes('@')) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const isOwner = email === resolveOwnerEmail();
    const result = await useCreditForGeneration(request, admin, email, isOwner);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, credits_remaining: result.credits_remaining },
        { status: result.status }
      );
    }

    if (isOwner) {
      return NextResponse.json({ credits_remaining: 999999 });
    }

    const billingEmail = result.billingEmail ?? email;
    const { data: row } = await admin
      .from('subscriptions')
      .select('credits_remaining')
      .eq('email', billingEmail)
      .maybeSingle();

    const remaining = Math.max(0, row?.credits_remaining ?? 0);
    return NextResponse.json({ credits_remaining: remaining });
  } catch (err) {
    console.error('POST /api/use-credit:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
