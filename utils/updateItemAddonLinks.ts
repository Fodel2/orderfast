import { supabase } from './supabaseClient';

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
  // Remove existing links for the item
  try {
    const itemIdStr = String(itemId);
    const { error: deleteError } = await supabase
      .from('item_addon_links')
      .delete()
      .eq('item_id', itemIdStr);
    if (deleteError) throw deleteError;

    if (selectedAddonGroupIds.length > 0) {
      const unique = Array.from(new Set(selectedAddonGroupIds.map(String)));
      const rows = unique.map((groupId) => ({
        item_id: itemIdStr,
        group_id: groupId,
      }));
      const { error: upsertError } = await supabase
        .from('item_addon_links')
        .upsert(rows, { onConflict: 'item_id,group_id' });

      if (upsertError) throw upsertError;
    }
  } catch (err) {
    console.error('Failed to update item addon links', err);
    throw err;
  }
}
