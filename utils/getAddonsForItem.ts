import { supabase } from '../lib/supabaseClient';
import { ITEM_ADDON_LINK_WITH_GROUPS_SELECT } from '../lib/queries/addons';
import type { AddonGroup } from './types';

/**
 * Fetch live addon groups and options for a menu item.
 */
export async function getAddonsForItem(
  itemId: number | string
): Promise<AddonGroup[]> {
  const itemIdStr = String(itemId);

  const linkQuery = supabase
    .from('item_addon_links')
    .select(ITEM_ADDON_LINK_WITH_GROUPS_SELECT)
    .eq('item_id', itemIdStr)
    .is('addon_groups.archived_at', null)
    .is('addon_groups.addon_options.archived_at', null);

  const requestUrl = (linkQuery as unknown as { url?: URL }).url?.toString();

  const { data: linkRows, error: linkError } = await linkQuery;

  if (linkError) throw linkError;

  const groupsMap = new Map<string, AddonGroup>();

  (linkRows || []).forEach((row: any) => {
    const group = Array.isArray(row.addon_groups)
      ? row.addon_groups[0]
      : row.addon_groups;
    if (!group || group.archived_at) return;

    const gid = String(group.id);
    if (!groupsMap.has(gid)) {
      groupsMap.set(gid, {
        id: gid,
        group_id: gid,
        name: group.name,
        required: group.required,
        multiple_choice: group.multiple_choice,
        max_group_select: group.max_group_select,
        max_option_quantity: group.max_option_quantity,
        addon_options: [],
      });
    }

    const groupRef = groupsMap.get(gid)!;
    const options = Array.isArray(group.addon_options)
      ? group.addon_options
      : group.addon_options
      ? [group.addon_options]
      : [];

    for (const option of options) {
      if (!option || option.archived_at) continue;
      groupRef.addon_options.push({
        id: String(option.id),
        group_id: gid,
        name: option.name,
        price:
          typeof option.price === 'number'
            ? option.price
            : Number(option.price ?? 0),
        available: option.available !== false,
        out_of_stock_until: option.out_of_stock_until,
        stock_status: option.stock_status,
        stock_return_date: option.stock_return_date,
        stock_last_updated_at: option.stock_last_updated_at,
      });
    }
  });

  if (process.env.NODE_ENV === 'development') {
    console.debug('[customer:addons:live]', {
      itemId: itemIdStr,
      groups: groupsMap.size,
      requestUrl,
    });
  }

  return Array.from(groupsMap.values());
}

