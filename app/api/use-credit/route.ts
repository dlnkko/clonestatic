import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'subscription_email';

export async function POST(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }
  let email: string | null = null;
  try {
    const body = await request.json();
    email = body?.email?.trim()?.toLowerCase();
  } catch {
    // ignore
  }
  if (!email || !email.includes('@')) {
    const cookieStore = await cookies();
    const c = cookieStore.get(COOKIE_NAME);
    email = c?.value?.trim()?.toLowerCase() ?? null;
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email required (body or cookie)' }, { status: 400 });
  }
  try {
    const supabase = createAdminClient();
    const { data: row, error: fetchError } = await supabase
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
    const { error: updateError } = await supabase
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
