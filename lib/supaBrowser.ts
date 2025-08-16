import { createClient } from '@supabase/supabase-js';

export function getBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Supabase client env missing');
    }
    throw new Error('Supabase client env missing');
  }
  return createClient(url, key);
}

