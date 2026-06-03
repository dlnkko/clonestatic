import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { enrichWhopPayloadFromApi } from '@/lib/whop';
import { normalizeWhopEvent, upsertWhopSubscription } from '@/lib/whop-subscription';
import { unwrapWhopWebhook } from '@/lib/whop-sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Webhook: Supabase not configured');
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const rawBody = await request.text();

  let body: Record<string, unknown>;
  try {
    body = unwrapWhopWebhook(rawBody, request.headers);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = normalizeWhopEvent(body);
  const parsed = await enrichWhopPayloadFromApi(body);
  const email = parsed?.email ?? null;

  const isDeactivate =
    /membership\.deactivated|membership\.went_invalid|subscription\.cancelled|subscription\.canceled|payment\.failed/i.test(
      event
    );

  if (isDeactivate) {
    if (!email) {
      return NextResponse.json({ received: true, skipped: true, event, reason: 'no_email' });
    }
    try {
      const supabase = createAdminClient();
      await supabase.from('subscriptions').delete().eq('email', email);
      return NextResponse.json({ received: true, deactivated: true, email });
    } catch (err) {
      console.error('Whop webhook deactivate error:', err);
      return NextResponse.json({ error: 'Failed to deactivate subscription' }, { status: 500 });
    }
  }

  const isCancelScheduled = /membership\.cancel_at_period_end_changed|cancel_at_period_end/i.test(event);
  if (isCancelScheduled && email) {
    const data = (body.data ?? {}) as Record<string, unknown>;
    const cancelAtPeriodEnd = data.cancel_at_period_end === true;
    try {
      const supabase = createAdminClient();
      await supabase
        .from('subscriptions')
        .update({
          cancel_at_period_end: cancelAtPeriodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email);
      return NextResponse.json({ received: true, cancel_at_period_end: cancelAtPeriodEnd, email });
    } catch (err) {
      console.error('Whop webhook cancel flag error:', err);
    }
  }

  const isPayment =
    /payment\.(succeeded|completed)|membership\.(went_valid|activated|created|valid)|subscription\.(created|activated)|invoice\.paid/i.test(
      event
    );

  if (!parsed?.email) {
    if (isPayment) {
      console.error('Whop webhook: no email in payload', JSON.stringify(body).slice(0, 1200));
      return NextResponse.json({ error: 'No email in payload' }, { status: 400 });
    }
    return NextResponse.json({ received: true, skipped: true, event });
  }

  if (!isPayment && !parsed.planId) {
    return NextResponse.json({ received: true, skipped: true, event });
  }

  try {
    const supabase = createAdminClient();
    const { row, error } = await upsertWhopSubscription(supabase, parsed);
    if (error) {
      console.error('Whop webhook Supabase upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      received: true,
      email: row.email,
      plan: row.plan,
      credits: row.credits_remaining,
      membershipId: row.whop_membership_id,
      event,
    });
  } catch (err) {
    console.error('Whop webhook error:', err);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}
