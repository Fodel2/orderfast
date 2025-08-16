import { createClient } from '@supabase/supabase-js';

export function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[supaServer] missing env');
    }
    throw new Error('missing_env');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Pre-initialized service-role client for server usage (may be null if env missing)
let supa: ReturnType<typeof getServerClient> | null = null;
try {
  supa = getServerClient();
} catch {
  supa = null;
}
export const supaServer = supa;


