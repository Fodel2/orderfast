import { createClient } from '@supabase/supabase-js';

export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[env] Missing Supabase server env');
    throw new Error('Missing Supabase server env');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

