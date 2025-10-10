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
        id,restaurant_id,name,required,multiple_choice,max_group_select,max_option_quantity,
        addon_options!inner(
          id,group_id,name,price,available,out_of_stock_until,stock_status,stock_return_date,stock_last_updated_at
        )
      )`
    )
    .eq('item_id', itemId);

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
      if (opt?.available === false) return;
      group.addon_options.push({
        id: String(opt.id),
        group_id: opt.group_id ? String(opt.group_id) : gid,
        name: opt.name,
        price: opt.price,
        available: opt.available,
        out_of_stock_until: opt.out_of_stock_until,
        stock_status: opt.stock_status,
        stock_return_date: opt.stock_return_date,
        stock_last_updated_at: opt.stock_last_updated_at,
      });
    });
  });

  if (process.env.NODE_ENV === 'development') {
    console.debug('[customer:addons]', { itemId, groups: map.size });
  }

  return Array.from(map.values());
}

