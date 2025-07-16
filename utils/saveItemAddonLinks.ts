import { supabase } from './supabaseClient';

interface ItemLinkData {
  id: string | number;
  selectedAddonGroupIds: (string | number)[];
}

/**
 * Batch update addon group links for multiple menu items.
 * Existing links for the provided items will be removed
 * and new links inserted in a single operation.
 */
export async function saveItemAddonLinks(items: ItemLinkData[]) {
  if (!items.length) return;

  const itemIds = items.map((i) => i.id);

  try {
    // Remove existing links for these items
    if (itemIds.length) {
      const { error } = await supabase
        .from('item_addon_links')
        .delete()
        .in('item_id', itemIds);
      if (error) throw error;
    }

    // Prepare rows for batch insert
    const rows = items.flatMap((item) =>
      (item.selectedAddonGroupIds || []).map((gid) => ({
        item_id: item.id,
        group_id: gid,
      }))
    );

    if (rows.length) {
      const { error } = await supabase.from('item_addon_links').insert(rows);
      if (error) throw error;
    }
  } catch (err) {
    console.error('Failed to save item addon links', err);
    throw err;
  }
}
