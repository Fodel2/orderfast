import type { SupabaseClient } from '@supabase/supabase-js';

export type MenuBuilderDraft = {
  categories: any[];
  items: any[];
  itemAddonLinks: any[];
  itemCategories: any[];
};

export async function loadDraft(
  supabase: SupabaseClient,
  userId: string,
  restaurantId: string
) {
  return supabase
    .from('menu_builder_drafts')
    .select('id, restaurant_id, payload, updated_at')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
}

export async function saveDraft(
  supabase: SupabaseClient,
  userId: string,
  restaurantId: string,
  payload: MenuBuilderDraft
) {
  return supabase
    .from('menu_builder_drafts')
    .upsert(
      {
        user_id: userId,
        restaurant_id: restaurantId,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,restaurant_id' }
    )
    .select('id')
    .single();
}
