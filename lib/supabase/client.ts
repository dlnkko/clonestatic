import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseAnonKey } from '@/lib/supabase/auth-config';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = getSupabaseAnonKey();
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  return createBrowserClient(url, anonKey);
}

/** Returns true if Supabase env vars are set (for feature flags like History tab). */
export function isSupabaseConfigured(): boolean {
  try {
    return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getSupabaseAnonKey());
  } catch {
    return false;
  }
}
