import { redirect } from 'next/navigation';
import { POST_PURCHASE_ONBOARDING_PATH } from '@/lib/discovery-sources';

/** Keep the old dashed path working for anyone already in flight. */
export default function LegacyOnboardingRedirect() {
  redirect(POST_PURCHASE_ONBOARDING_PATH);
}
