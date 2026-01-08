import { supabase } from '../lib/supabaseClient';
import { ADDON_GROUP_FIELDS, ADDON_OPTION_FIELDS } from '../lib/queries/addons';
import type { AddonGroup } from './types';

/**
 * Fetch live addon groups and options for a menu item.
 */
export async function getAddonsForItem(
  itemId: number | string,
  restaurantId?: string | number | null
): Promise<AddonGroup[]> {
  const itemIdStr = String(itemId);
  const restaurantIdStr =
    restaurantId != null && restaurantId !== '' ? String(restaurantId) : null;

  const linkQuery = supabase
    .from('item_addon_links')
    .select('group_id')
    .eq('item_id', itemIdStr);

  const requestUrl = (linkQuery as unknown as { url?: URL }).url?.toString();

  const { data: linkRows, error: linkError } = await linkQuery;

  if (linkError) throw linkError;

  const groupIds = Array.from(
    new Set(
      (linkRows || [])
        .map((row: any) => row?.group_id)
        .filter((id: any) => id != null)
        .map((id: any) => String(id))
    )
  );

  if (!groupIds.length) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[customer:addons:live]', {
        itemId: itemIdStr,
        restaurantId: restaurantIdStr,
        groups: 0,
        requestUrl,
      });
    }
    return [];
  }

  const groupQuery = supabase
    .from('addon_groups')
    .select(ADDON_GROUP_FIELDS)
    .in('id', groupIds)
    .is('archived_at', null)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (restaurantIdStr) {
    groupQuery.eq('restaurant_id', restaurantIdStr);
  }

  const optionQuery = supabase
    .from('addon_options')
    .select(ADDON_OPTION_FIELDS)
    .in('group_id', groupIds)
    .is('archived_at', null)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  const [{ data: groupRows, error: groupError }, { data: optionRows, error: optionError }] =
    await Promise.all([groupQuery, optionQuery]);

  if (groupError) throw groupError;
  if (optionError) throw optionError;

  const optionsByGroup = new Map<string, typeof optionRows>();
  (optionRows || []).forEach((option: any) => {
    const gid = option?.group_id != null ? String(option.group_id) : null;
    if (!gid) return;
    const arr = optionsByGroup.get(gid) ?? [];
    arr.push(option);
    optionsByGroup.set(gid, arr);
  });

  const groups = (groupRows || [])
    .map((group: any) => {
      const gid = group?.id != null ? String(group.id) : null;
      if (!gid) return null;
      const rawOptions = optionsByGroup.get(gid) ?? [];
      const addonOptions = rawOptions
        .filter((option: any) => option && option.archived_at == null)
        .map((option: any) => ({
          id: String(option.id),
          group_id: gid,
          name: option.name,
          sort_order: option.sort_order ?? null,
          price:
            typeof option.price === 'number'
              ? option.price
              : Number(option.price ?? 0),
          available: option.available !== false,
          out_of_stock_until: option.out_of_stock_until,
          stock_status: option.stock_status,
          stock_return_date: option.stock_return_date,
          stock_last_updated_at: option.stock_last_updated_at,
        }));

      return {
        id: gid,
        group_id: gid,
        name: group.name,
        sort_order: group.sort_order ?? null,
        required: group.required,
        multiple_choice: group.multiple_choice,
        max_group_select: group.max_group_select,
        max_option_quantity: group.max_option_quantity,
        addon_options: addonOptions,
      } as AddonGroup;
    })
    .filter(Boolean) as AddonGroup[];

  if (process.env.NODE_ENV === 'development') {
    console.debug('[customer:addons:live]', {
      itemId: itemIdStr,
      restaurantId: restaurantIdStr,
      groups: groups.length,
      requestUrl,
    });
  }

  return groups
    .map((group) => ({
      ...group,
      addon_options: [...group.addon_options].sort((a, b) => {
        const aOrder = a.sort_order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.sort_order ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      }),
    }))
    .sort((a, b) => {
      const aOrder = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });
}
