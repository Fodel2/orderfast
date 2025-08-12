import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables are missing.');
  throw new Error('Supabase is not configured');
}

// Create a single browser client instance to be shared across the app
export const supabase = createBrowserSupabaseClient();
