import { supabase } from '../utils/supabaseClient';

export type MenuBuilderDraft = { categories: any[]; items: any[] };

export async function loadDraft(restaurantId: string): Promise<MenuBuilderDraft> {
  const { data } = await supabase
    .from('menu_builder_drafts')
    .select('id, restaurant_id, payload, updated_at')
    .eq('restaurant_id', restaurantId)
    .single();

  if (!data || !data.payload) {
    return { categories: [], items: [] };
  }

  const payload = data.payload as any;
  return {
    categories: Array.isArray(payload.categories) ? payload.categories : [],
    items: Array.isArray(payload.items) ? payload.items : [],
  };
}

export async function saveDraft(
  restaurantId: string,
  payload: MenuBuilderDraft
): Promise<void> {
  await supabase
    .from('menu_builder_drafts')
    .upsert(
      { restaurant_id: restaurantId, payload, updated_at: new Date().toISOString() },
      { onConflict: 'restaurant_id' }
    )
    .select('id');
}
