import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: 'Not configured' }, { status: 503 });
  }
  const email = request.nextUrl.searchParams.get('email')?.trim()?.toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Valid email required' }, { status: 400 });
  }
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
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
