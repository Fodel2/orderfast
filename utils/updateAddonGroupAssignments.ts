import { supabase } from './supabaseClient';
import { ensureItemExternalKey } from './updateItemAddonLinks';

type AssignmentItem = {
  id: string;
  external_key?: string | null;
};

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

export async function updateAddonGroupAssignments({
  restaurantId,
  groupId,
  items,
}: {
  restaurantId: string;
  groupId: string;
  items: AssignmentItem[];
}) {
  if (!restaurantId || !groupId) {
    throw new Error('Missing restaurantId or groupId for assignment save');
  }

  const uniqueItems = Array.from(new Map(items.map((item) => [String(item.id), item])).values());

  const externalKeyMap: Record<string, string> = {};

  for (const item of uniqueItems) {
    const normalizedId = String(item.id);
    if (item.external_key) {
      externalKeyMap[normalizedId] = String(item.external_key);
      continue;
    }
    const { restaurantId: itemRestaurantId, externalKey } = await ensureItemExternalKey(normalizedId);
    if (String(itemRestaurantId) !== String(restaurantId)) {
      throw new Error('Item does not belong to the current restaurant');
    }
    externalKeyMap[normalizedId] = externalKey;
  }

  const { error: deleteError } = await supabase
    .from('item_addon_links_drafts')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('group_id', groupId);

  if (deleteError) throw deleteError;

  const rows = uniqueItems.map((item) => {
    const normalizedId = String(item.id);
    const externalKey = externalKeyMap[normalizedId];
    return {
      id: generateId(),
      restaurant_id: restaurantId,
      item_id: normalizedId,
      item_external_key: externalKey,
      group_id: groupId,
      state: 'draft',
    };
  });

  if (rows.length) {
    const { error: insertError } = await supabase.from('item_addon_links_drafts').insert(rows);
    if (insertError) throw insertError;
  }

  return { externalKeyMap };
}
