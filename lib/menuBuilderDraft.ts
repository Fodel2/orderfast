import { supabase } from '../utils/supabaseClient';

export interface MenuBuilderDraft {
  categories: any[];
  items: any[];
}

export async function loadDraft(restaurantId: string | number): Promise<MenuBuilderDraft> {
  const { data, error } = await supabase
    .from('menu_builder_drafts')
    .select('draft')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error || !data || !data.draft) {
    return { categories: [], items: [] };
  }

  const draft = data.draft as any;
  return {
    categories: Array.isArray(draft.categories) ? draft.categories : [],
    items: Array.isArray(draft.items) ? draft.items : [],
  };
}

export async function saveDraft(
  restaurantId: string | number,
  draft: MenuBuilderDraft
): Promise<void> {
  await supabase
    .from('menu_builder_drafts')
    .upsert({ restaurant_id: restaurantId, draft });
  if (process.env.NODE_ENV === 'development') {
    console.debug('[builder:draft] save', {
      cats: draft.categories.length,
      items: draft.items.length,
    });
  }
}
