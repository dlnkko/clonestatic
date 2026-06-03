/** Canonical app origin for OAuth redirects (must match Supabase Site URL + Redirect URLs). */
export function getAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3001';
  }
  return 'https://www.admirror.app';
}

export function getSupabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Missing Supabase anon/publishable key');
  return key;
}

export function isAppHost(host: string): boolean {
  const normalized = host.toLowerCase().split(':')[0];
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === 'admirror.app' ||
    normalized === 'www.admirror.app'
  );
}
