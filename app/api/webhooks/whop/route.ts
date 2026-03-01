import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const WHOP_PLAN_IDS = {
  standard: ['plan_1qy7pizl7xAkx', 'plan_KRjrbQ6Z0D2A5'],
  pro: ['plan_xb9A75BEfcTGk', 'plan_CNk2XegENVQGM'],
} as const;

function getPlanFromPayload(planId: string | undefined): 'standard' | 'pro' {
  if (!planId || typeof planId !== 'string') return 'standard';
  if (WHOP_PLAN_IDS.pro.includes(planId as any)) return 'pro';
  if (WHOP_PLAN_IDS.standard.includes(planId as any)) return 'standard';
  return 'standard';
}

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
    const signature = request.headers.get('webhook-signature') ?? request.headers.get('x-whop-signature') ?? request.headers.get('whop-signature');
    if (!signature) {
      console.error('Whop webhook: missing signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    const payload = rawBody;
    const expectedHex = createHmac('sha256', secret).update(payload).digest('hex');
    const expectedBase64 = createHmac('sha256', secret).update(payload).digest('base64');
    const raw = signature.replace(/^v1,/, '').replace(/^sha256=/, '').trim();
    const valid = raw === expectedHex || raw === expectedBase64 || signature === expectedHex || signature === expectedBase64;
    if (!valid) {
      console.error('Whop webhook: signature mismatch');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  const event = body?.action ?? body?.event ?? body?.type ?? '';
  const isPayment = /payment\.succeeded|membership\.went_valid|subscription\.(created|activated)/i.test(event);
  if (!isPayment) {
    return NextResponse.json({ received: true, skipped: true, event });
  }

  const email = getEmailFromPayload(body);
  if (!email) {
    console.error('Whop webhook: no email in payload', JSON.stringify(body).slice(0, 500));
    return NextResponse.json({ error: 'No email in payload' }, { status: 400 });
  }

  const planId = getPlanIdFromPayload(body);
  const plan = getPlanFromPayload(planId);
  const credits = plan === 'pro' ? 100 : 25;
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
        whop_member_id: body?.data?.member?.id ?? body?.member?.id ?? body?.object?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    );
    if (error) {
      console.error('Whop webhook Supabase upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ received: true, email, plan, credits });
  } catch (err) {
    console.error('Whop webhook error:', err);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}
