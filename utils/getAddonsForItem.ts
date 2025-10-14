import { supabase } from '../lib/supabaseClient';
import type { AddonGroup } from './types';

/**
 * Fetch addon groups and options for a menu item.
 */
export async function getAddonsForItem(
  itemId: number | string
): Promise<AddonGroup[]> {
  const query = supabase
    .from('item_addon_links')
    .select(
      `
      id,
      addon_groups (
        id,
        name,
        multiple_choice,
        required,
        max_group_select,
        max_option_quantity,
        addon_options (
          id,
          name,
          price,
          available,
          stock_status,
          stock_return_date,
          stock_last_updated_at
        )
      )
    `
    )
    .eq('item_id', itemId);

  const requestUrl = (query as unknown as { url?: URL }).url?.toString();

  const { data, error } = await query;

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[customer:addons] failed to fetch add-ons', {
        itemId,
        requestUrl,
        error,
      });
    }
    throw error;
  }

  const addonGroups = new Map<string, AddonGroup>();
  const optionIdsByGroup = new Map<string, Set<string>>();

  (data ?? []).forEach((row: any) => {
    const group = row?.addon_groups;
    if (!group) return;

    const gid = String(group.id);
    if (!addonGroups.has(gid)) {
      addonGroups.set(gid, {
        id: gid,
        group_id: gid,
        restaurant_id: group.restaurant_id ? String(group.restaurant_id) : undefined,
        name: group.name,
        required: group.required,
        multiple_choice: group.multiple_choice,
        max_group_select: group.max_group_select,
        max_option_quantity: group.max_option_quantity,
        addon_options: [],
      });
      optionIdsByGroup.set(gid, new Set());
    }

    const targetGroup = addonGroups.get(gid)!;
    const optionIds = optionIdsByGroup.get(gid)!;
    const options: any[] = Array.isArray(group.addon_options)
      ? group.addon_options
      : [];

    options.forEach((opt) => {
      const optionId = String(opt.id);
      if (optionIds.has(optionId)) return;
      optionIds.add(optionId);

      targetGroup.addon_options.push({
        id: optionId,
        group_id: opt.group_id ? String(opt.group_id) : gid,
        name: opt.name,
        price: typeof opt.price === 'number' ? opt.price : opt.price == null ? null : Number(opt.price),
        available: opt.available,
        out_of_stock_until: opt.out_of_stock_until,
        stock_status: opt.stock_status,
        stock_return_date: opt.stock_return_date,
        stock_last_updated_at: opt.stock_last_updated_at,
      });
    });
  });

  const result = Array.from(addonGroups.values());

  if (process.env.NODE_ENV === 'development') {
    console.debug('[customer:addons] fetched add-ons for item', {
      itemId,
      requestUrl,
      rows: data?.length ?? 0,
      addonGroups: result.length,
      addonOptions: result.reduce(
        (sum, group) => sum + (group.addon_options?.length ?? 0),
        0,
      ),
    });
  }

  return result;
}

