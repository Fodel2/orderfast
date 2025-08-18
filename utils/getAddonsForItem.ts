import { supabase } from '../lib/supabaseClient';
import type { AddonGroup } from './types';

/**
 * Fetch addon groups and options for a menu item.
 */
export async function getAddonsForItem(
  itemId: number | string
): Promise<AddonGroup[]> {
  const { data, error } = await supabase
    .from('item_addon_links')
    .select(
      `addon_groups!inner(
        id,name,required,multiple_choice,max_group_select,max_option_quantity,
        addon_options!inner(id,name,price,is_vegetarian,is_vegan,is_18_plus,image_url)
      )`
    )
    .eq('item_id', itemId)
    .is('addon_groups.archived_at', null)
    .is('addon_groups.addon_options.archived_at', null);

  if (error) throw error;

  const map = new Map<string, AddonGroup>();
  (data || []).forEach((row: any) => {
    const g = row.addon_groups;
    if (!g) return;
    const gid = String(g.id);
    if (!map.has(gid)) {
      map.set(gid, {
        id: gid,
        group_id: gid,
        name: g.name,
        required: g.required,
        multiple_choice: g.multiple_choice,
        max_group_select: g.max_group_select,
        max_option_quantity: g.max_option_quantity,
        addon_options: [],
      });
    }
    const group = map.get(gid)!;
    (g.addon_options || []).forEach((opt: any) => {
      group.addon_options.push({
        id: String(opt.id),
        name: opt.name,
        price: opt.price,
        image_url: opt.image_url,
        is_vegetarian: opt.is_vegetarian,
        is_vegan: opt.is_vegan,
        is_18_plus: opt.is_18_plus,
      });
    });
  });

  if (process.env.NODE_ENV === 'development') {
    console.debug('[customer:addons]', { itemId, groups: map.size });
  }

  return Array.from(map.values());
}

