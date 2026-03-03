import { createBrowserClient } from '@supabase/ssr';

function getSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or Supabase anon/publishable key (NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)');
  }
  return createBrowserClient(url, anonKey);
}

/** Returns true if Supabase env vars are set (for feature flags like History tab). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      getSupabaseAnonKey()
  );
}
