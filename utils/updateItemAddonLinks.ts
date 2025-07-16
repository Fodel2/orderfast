import { supabase } from './supabaseClient';

/**
 * Replace the addon links for a menu item with the given group IDs.
 */
export async function updateItemAddonLinks(itemId: string, selectedAddonGroupIds: string[]) {
  // Remove existing links for the item
  await supabase.from('item_addon_links').delete().eq('item_id', itemId);

  if (selectedAddonGroupIds.length > 0) {
    const rows = selectedAddonGroupIds.map((groupId) => ({
      item_id: itemId,
      group_id: groupId,
    }));
    await supabase.from('item_addon_links').insert(rows);
  }
}
