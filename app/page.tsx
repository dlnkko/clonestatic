import { redirect } from 'next/navigation';
import { LandingPage } from './components/landing/LandingPage';

type PageProps = {
  searchParams: Promise<{ code?: string; next?: string; plan?: string }>;
};

/** Server fallback if middleware does not run: OAuth code on / → /auth/callback */
export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  if (params.code) {
    const qs = new URLSearchParams();
    qs.set('code', params.code);
    if (params.next) qs.set('next', params.next);
    if (params.plan) qs.set('plan', params.plan);
    redirect(`/auth/callback?${qs.toString()}`);
  }

  return <LandingPage />;
}
