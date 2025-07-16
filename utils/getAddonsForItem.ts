import { supabase } from './supabaseClient';

export interface AddonOption {
  id: number | string;
  name: string;
  price: number | null;
}

export interface AddonGroup {
  id: number | string;
  name: string;
  required: boolean;
  multiple_choice: boolean;
  addon_options: AddonOption[];
}

/**
 * Fetch addon groups and options for a menu item using the view `view_addons_for_item`.
 * The view returns one row per option so we group the records by addon_group_id.
 */
export async function getAddonsForItem(itemId: number | string): Promise<AddonGroup[]> {
  const { data, error } = await supabase
    .from('view_addons_for_item')
    .select('*')
    .eq('item_id', itemId);

  if (error) throw error;

  const map: Record<string | number, AddonGroup> = {};

  for (const row of data || []) {
    if (!map[row.addon_group_id]) {
      map[row.addon_group_id] = {
        id: row.addon_group_id,
        name: row.addon_group_name,
        required: row.required,
        multiple_choice: row.multiple_choice,
        addon_options: [],
      };
    }
    if (row.addon_option_id) {
      map[row.addon_group_id].addon_options.push({
        id: row.addon_option_id,
        name: row.addon_option_name,
        price: row.price,
      });
    }
  }

  return Object.values(map);
}
