import { supabase } from '../utils/supabaseClient';

export type MenuBuilderDraft = { categories: any[]; items: any[] };

export async function loadDraft(restaurantId: string): Promise<MenuBuilderDraft> {
  const { data } = await supabase
    .from('menu_builder_drafts')
    .select('draft')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (!data || !data.draft) {
    return { categories: [], items: [] };
  }

  const draft = data.draft as any;
  return {
    categories: Array.isArray(draft.categories) ? draft.categories : [],
    items: Array.isArray(draft.items) ? draft.items : [],
  };
}

export async function saveDraft(
  restaurantId: string,
  draft: MenuBuilderDraft
): Promise<void> {
  await supabase
    .from('menu_builder_drafts')
    .upsert({ restaurant_id: restaurantId, draft });
}
