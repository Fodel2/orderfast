import { supabase } from './supabaseClient';
import type { AddonGroup } from './types';

/**
 * Fetch addon groups and options for a menu item via item_addon_links.
 */
export async function getAddonsForItem(
  itemId: number | string
): Promise<AddonGroup[]> {
  const { data, error } = await supabase
    .from('item_addon_links')
    .select('group_id, addon_groups(*, addon_options(*))')
    .eq('item_id', itemId);

  if (error) throw error;

  return (data || []).map((row: any) => {
    const g = row.addon_groups || {};
    return {
      id: String(row.group_id || g.id),
      group_id: String(row.group_id || g.id),
      name: g.name,
      required: g.required,
      multiple_choice: g.multiple_choice,
      max_group_select: g.max_group_select,
      max_option_quantity: g.max_option_quantity,
      addon_options: (g.addon_options || []).map((opt: any) => ({
        id: String(opt.id),
        name: opt.name,
        price: opt.price,
        image_url: opt.image_url ?? null,
      })),
    } as AddonGroup;
  });
}
