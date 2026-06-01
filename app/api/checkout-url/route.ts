import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WHOP_CHECKOUT_URLS } from '@/lib/plans';

export const dynamic = 'force-dynamic';

const PLAN_URLS: Record<string, string> = {
  standard_monthly:
    process.env.NEXT_PUBLIC_WHOP_CHECKOUT_STANDARD_MONTHLY || WHOP_CHECKOUT_URLS.standard_monthly,
  standard_yearly:
    process.env.NEXT_PUBLIC_WHOP_CHECKOUT_STANDARD_YEARLY || WHOP_CHECKOUT_URLS.standard_yearly,
  pro_monthly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_PRO_MONTHLY || WHOP_CHECKOUT_URLS.pro_monthly,
  pro_yearly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_PRO_YEARLY || WHOP_CHECKOUT_URLS.pro_yearly,
  scale_monthly:
    process.env.NEXT_PUBLIC_WHOP_CHECKOUT_SCALE_MONTHLY || WHOP_CHECKOUT_URLS.scale_monthly,
  scale_yearly: process.env.NEXT_PUBLIC_WHOP_CHECKOUT_SCALE_YEARLY || WHOP_CHECKOUT_URLS.scale_yearly,
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const plan = request.nextUrl.searchParams.get('plan')?.toLowerCase();
  const url = plan ? PLAN_URLS[plan] : null;
  if (!url) {
    return NextResponse.json({ error: 'Invalid or unavailable plan' }, { status: 400 });
  }

  return NextResponse.json({ url });
}
