import type { SupabaseClient } from '@supabase/supabase-js';

export type MenuBuilderDraft = {
  categories: any[];
  items: any[];
  itemAddonLinks: any[];
  itemCategories: any[];
};

export async function loadDraft(
  supabase: SupabaseClient,
  restaurantId: string
) {
  return supabase
    .from('menu_builder_drafts')
    .select('id, restaurant_id, payload, updated_at')
    .eq('restaurant_id', restaurantId)
    .single();
}

export async function saveDraft(
  supabase: SupabaseClient,
  restaurantId: string,
  payload: MenuBuilderDraft
) {
  return supabase
    .from('menu_builder_drafts')
    .upsert(
      { restaurant_id: restaurantId, payload, updated_at: new Date().toISOString() },
      { onConflict: 'restaurant_id' }
    )
    .select('id')
    .single();
}
