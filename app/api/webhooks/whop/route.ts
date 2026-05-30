import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createHmac } from 'crypto';
import { creditsForPlan, resolveWhopPlanKey, type PaidPlanKey } from '@/lib/plans';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getEmailFromPayload(body: any): string | null {
  const email =
    body?.data?.member?.email ??
    body?.data?.user?.email ??
    body?.member?.email ??
    body?.user?.email ??
    body?.object?.member?.email ??
    body?.object?.email ??
    body?.customer_email;
  return typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;
}

function getPlanIdFromPayload(body: any): string | undefined {
  return (
    body?.data?.plan?.id ??
    body?.data?.product?.id ??
    body?.plan?.id ??
    body?.product?.id ??
    body?.object?.plan_id ??
    body?.object?.product_id
  );
}

function getMembershipIdFromPayload(body: any): string | null {
  const candidates = [
    body?.data?.membership?.id,
    body?.data?.id,
    body?.membership?.id,
    body?.object?.membership_id,
    body?.object?.id,
  ];
  for (const id of candidates) {
    if (typeof id === 'string' && id.startsWith('mem_')) return id;
  }
  return null;
}

function normalizeEvent(body: any): string {
  return String(body?.action ?? body?.event ?? body?.type ?? '').toLowerCase();
}

export async function POST(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Webhook: Supabase not configured');
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  let body: any;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (secret) {
    const signature =
      request.headers.get('webhook-signature') ??
      request.headers.get('x-whop-signature') ??
      request.headers.get('whop-signature');
    if (!signature) {
      console.error('Whop webhook: missing signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBase64 = createHmac('sha256', secret).update(rawBody).digest('base64');
    const raw = signature.replace(/^v1,/, '').replace(/^sha256=/, '').trim();
    const valid =
      raw === expectedHex ||
      raw === expectedBase64 ||
      signature === expectedHex ||
      signature === expectedBase64;
    if (!valid) {
      console.error('Whop webhook: signature mismatch');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  const event = normalizeEvent(body);
  const email = getEmailFromPayload(body);

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
    const cancelAtPeriodEnd =
      body?.data?.cancel_at_period_end === true ||
      body?.object?.cancel_at_period_end === true ||
      body?.cancel_at_period_end === true;
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

  const isPayment = /payment\.succeeded|membership\.went_valid|membership\.activated|subscription\.(created|activated)/i.test(
    event
  );
  if (!isPayment) {
    return NextResponse.json({ received: true, skipped: true, event });
  }

  if (!email) {
    console.error('Whop webhook: no email in payload', JSON.stringify(body).slice(0, 500));
    return NextResponse.json({ error: 'No email in payload' }, { status: 400 });
  }

  const planId = getPlanIdFromPayload(body);
  const plan: PaidPlanKey = resolveWhopPlanKey(planId);
  const credits = creditsForPlan(plan);
  const membershipId = getMembershipIdFromPayload(body);
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('subscriptions').upsert(
      {
        email,
        plan,
        credits_remaining: credits,
        period_end: periodEnd.toISOString().slice(0, 10),
        whop_member_id: body?.data?.member?.id ?? body?.member?.id ?? null,
        whop_membership_id: membershipId,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    );
    if (error) {
      console.error('Whop webhook Supabase upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ received: true, email, plan, credits, membershipId });
  } catch (err) {
    console.error('Whop webhook error:', err);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}
