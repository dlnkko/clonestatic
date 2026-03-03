import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({
  children,
}: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login?next=/app');
  }

  const email = user.email?.trim()?.toLowerCase();
  if (!email || !email.includes('@')) {
    redirect('/login?next=/app');
  }

  return <>{children}</>;
}
