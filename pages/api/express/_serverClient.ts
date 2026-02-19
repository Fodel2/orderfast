import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let hasLoggedMissingServiceRoleKey = false;

export function getExpressServiceSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    if (!hasLoggedMissingServiceRoleKey && !serviceRoleKey) {
      hasLoggedMissingServiceRoleKey = true;
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

