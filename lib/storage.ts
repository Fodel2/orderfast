import { supabase } from '@/lib/supabaseClient';

export const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_STORAGE_BUCKET ?? 'menu-images';

export function getPublicUrl(bucket: string, path?: string | null) {
  if (!path) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}
