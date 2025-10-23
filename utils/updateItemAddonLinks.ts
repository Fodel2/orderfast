import { supabase } from './supabaseClient';

async function ensureItemExternalKey(itemId: string) {
  const { data, error } = await supabase
    .from('menu_items')
    .select('restaurant_id, external_key')
    .eq('id', itemId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(`Menu item ${itemId} not found while updating add-ons`);
  }

  let externalKey = data.external_key as string | null;
  if (!externalKey) {
    externalKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${itemId}-${Date.now()}`;

    const { error: updateError } = await supabase
      .from('menu_items')
      .update({ external_key: externalKey })
      .eq('id', itemId);

    if (updateError) throw updateError;
  }

  return { restaurantId: String(data.restaurant_id), externalKey };
}

/**
 * Replace the addon links for a menu item with the given group IDs.
 */
export async function updateItemAddonLinks(
  itemId: string | number,
  selectedAddonGroupIds: Array<string | number>
) {
  if (!itemId) {
    const msg = 'updateItemAddonLinks called with invalid itemId';
    console.error(msg, itemId);
    throw new Error(msg);
  }
  try {
    const itemIdStr = String(itemId);
    const { restaurantId, externalKey } = await ensureItemExternalKey(itemIdStr);

    const deleteQuery = supabase
      .from('item_addon_links_drafts')
      .delete()
      .eq('restaurant_id', restaurantId)
      .eq('item_external_key', externalKey);

    const { error: deleteError } = await deleteQuery;
    if (deleteError) throw deleteError;

    if (selectedAddonGroupIds.length > 0) {
      const unique = Array.from(new Set(selectedAddonGroupIds.map(String)));
      const rows = unique.map((groupId) => ({
        restaurant_id: restaurantId,
        item_external_key: externalKey,
        group_id_draft: groupId,
      }));
      const { error: insertError } = await supabase
        .from('item_addon_links_drafts')
        .insert(rows);

      if (insertError) throw insertError;
    }
  } catch (err) {
    console.error('Failed to update item addon links', err);
    throw err;
  }
}
