import { supabase } from './supabaseClient';

/**
 * Replace the addon links for a menu item with the given group IDs.
 */
export async function updateItemAddonLinks(itemId: string, selectedAddonGroupIds: string[]) {
  // Remove existing links for the item
  try {
    const { error: deleteError } = await supabase
      .from('item_addon_links')
      .delete()
      .eq('item_id', itemId);
    if (deleteError) throw deleteError;

    if (selectedAddonGroupIds.length > 0) {
      const rows = selectedAddonGroupIds.map((groupId) => ({
        item_id: itemId,
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
