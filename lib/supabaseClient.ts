import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV === 'development') {
    console.error('Supabase client (browser) env missing');
  }
  throw new Error('Supabase client env missing');
}

// Create a single browser client instance to be shared across the app
export const supabase = createBrowserSupabaseClient();
