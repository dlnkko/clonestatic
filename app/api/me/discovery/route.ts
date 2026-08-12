import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveBillingEmail } from '@/lib/team-members';
import { DISCOVERY_SOURCE_IDS, type DiscoverySourceId } from '@/lib/discovery-sources';

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

  let body: { source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const source = typeof body.source === 'string' ? body.source.trim().toLowerCase() : '';
  if (!DISCOVERY_SOURCE_IDS.includes(source as DiscoverySourceId)) {
    return NextResponse.json({ error: 'Invalid discovery source' }, { status: 400 });
  }

  const email = user.email.trim().toLowerCase();
  const admin = createAdminClient();
  const billing = await resolveBillingEmail(admin, email);
  const targetEmail = billing.billingEmail;

  const { data: existing } = await admin
    .from('subscriptions')
    .select('discovery_source')
    .eq('email', targetEmail)
    .maybeSingle();

  if (existing?.discovery_source) {
    return NextResponse.json({ ok: true, source: existing.discovery_source, kept: true });
  }

  const { error } = await admin
    .from('subscriptions')
    .update({
      discovery_source: source,
      updated_at: new Date().toISOString(),
    })
    .eq('email', targetEmail);

  if (error) {
    console.error('POST /api/me/discovery:', error);
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, source });
}
