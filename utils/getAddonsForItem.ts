import { supabase } from '../lib/supabaseClient';
import type { AddonGroup } from './types';

/**
 * Fetch addon groups and options for a menu item.
 */
export async function getAddonsForItem(
  itemId: number | string
): Promise<AddonGroup[]> {
  const itemIdStr = String(itemId);

  const linkQuery = supabase
    .from('item_addon_links_drafts')
    .select(
      'group_id,group_id_draft,restaurant_id,state,addon_groups_drafts!inner(id,name,required,multiple_choice,max_group_select,max_option_quantity,state,archived_at)'
    )
    .eq('item_id', itemIdStr)
    .eq('state', 'draft')
    .eq('addon_groups_drafts.state', 'draft')
    .is('addon_groups_drafts.archived_at', null);

  const requestUrl = (linkQuery as unknown as { url?: URL }).url?.toString();

  const { data: linkRows, error: linkError } = await linkQuery;

  if (linkError) throw linkError;

  const groupsMap = new Map<string, AddonGroup>();
  const groupIds: Set<string> = new Set();

  (linkRows || []).forEach((row: any) => {
    const group = row.addon_groups_drafts;
    if (!group) return;
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
      groupIds.add(gid);
    }
  });

  let optionCount = 0;

  if (groupIds.size > 0) {
    const { data: optionRows, error: optionError } = await supabase
      .from('addon_options_drafts')
      .select(
        'id,group_id,name,price,available,out_of_stock_until,stock_status,stock_return_date,stock_last_updated_at,state,archived_at'
      )
      .in('group_id', Array.from(groupIds))
      .eq('state', 'draft')
      .is('archived_at', null);

    if (optionError) throw optionError;

    for (const option of optionRows || []) {
      const gid = option.group_id ? String(option.group_id) : undefined;
      if (!gid) continue;
      const group = groupsMap.get(gid);
      if (!group) continue;
      group.addon_options.push({
        id: String(option.id),
        group_id: gid,
        name: option.name,
        price: option.price,
        available: option.available,
        out_of_stock_until: option.out_of_stock_until,
        stock_status: option.stock_status,
        stock_return_date: option.stock_return_date,
        stock_last_updated_at: option.stock_last_updated_at,
      });
      optionCount++;
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug('[customer:addons:drafts]', {
      itemId: itemIdStr,
      rawRows: linkRows?.length ?? 0,
      groups: groupsMap.size,
      options: optionCount,
      requestUrl,
    });
  }

  return Array.from(groupsMap.values());
}

