import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.email) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const email = user.email.trim().toLowerCase();
  if (!email.includes('@')) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: row, error: fetchError } = await admin
      .from('subscriptions')
      .select('credits_remaining')
      .eq('email', email)
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    const current = Math.max(0, row.credits_remaining ?? 0);
    if (current < 1) {
      return NextResponse.json({ error: 'No credits remaining', credits_remaining: 0 }, { status: 402 });
    }

    const { error: updateError } = await admin
      .from('subscriptions')
      .update({
        credits_remaining: current - 1,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email);

    if (updateError) {
      console.error('use-credit update error:', updateError);
      return NextResponse.json({ error: 'Failed to use credit' }, { status: 500 });
    }

    return NextResponse.json({ credits_remaining: current - 1 });
  } catch (err) {
    console.error('POST /api/use-credit:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
