import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PLAN_URLS: Record<string, string> = {
  standard_monthly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_STANDARD_MONTHLY || 'https://whop.com/checkout/plan_1qy7pizl7xAkx',
  standard_yearly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_STANDARD_YEARLY || 'https://whop.com/checkout/plan_KRjrbQ6Z0D2A5',
  pro_monthly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_PRO_MONTHLY || 'https://whop.com/checkout/plan_xb9A75BEfcTGk',
  pro_yearly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_PRO_YEARLY || 'https://whop.com/checkout/plan_CNk2XegENVQGM',
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const plan = request.nextUrl.searchParams.get('plan')?.toLowerCase();
  const url = plan ? PLAN_URLS[plan] : null;
  if (!url) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  return NextResponse.json({ url });
}
