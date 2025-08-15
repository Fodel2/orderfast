import { getSupabaseAdmin } from '../lib/supabaseAdmin';

export function supaService() {
  return getSupabaseAdmin();
}
