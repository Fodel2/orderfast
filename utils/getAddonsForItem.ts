import { supabase } from '../lib/supabaseClient';
import type { AddonGroup } from './types';

/**
 * Fetch addon groups and options for a menu item.
 */
export async function getAddonsForItem(
  itemId: number | string
): Promise<AddonGroup[]> {
  const { data, error } = await supabase
    .from('view_addons_for_item')
    .select('*')
    .eq('item_id', itemId);

  if (error) throw error;

  const map = new Map<string, AddonGroup>();
  (data || []).forEach((row: any) => {
    const gid = String(row.addon_group_id);
    if (!map.has(gid)) {
      map.set(gid, {
        id: gid,
        group_id: gid,
        name: row.addon_group_name,
        required: row.required,
        multiple_choice: row.multiple_choice,
        max_group_select: row.max_group_select,
        max_option_quantity: row.max_option_quantity,
        addon_options: [],
      });
    }
    if (row.addon_option_id) {
      map.get(gid)!.addon_options.push({
        id: String(row.addon_option_id),
        name: row.addon_option_name,
        price: row.price,
        image_url: null,
      });
    }
  });

  if (process.env.NODE_ENV === 'development') {
    console.debug('[customer:addons]', { itemId, groups: map.size });
  }

  return Array.from(map.values());
}
