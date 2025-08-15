import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Supabase admin env missing');
    }
    throw new Error('Missing service env');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
