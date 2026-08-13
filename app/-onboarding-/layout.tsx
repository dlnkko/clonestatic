import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { POST_PURCHASE_ONBOARDING_PATH } from '@/lib/discovery-sources';
import { AppProviders } from '@/app/app/providers';

export const metadata: Metadata = {
  title: '-onboarding-',
  robots: { index: false, follow: false },
};

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(`/login?next=${encodeURIComponent(POST_PURCHASE_ONBOARDING_PATH)}`);
  }

  return <AppProviders>{children}</AppProviders>;
}
