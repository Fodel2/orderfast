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

  console.info('[addon-assignments:drafts:delete]', { restaurantId, groupId, itemCount: uniqueItems.length });

  const { error: deleteError } = await supabase
    .from('item_addon_links_drafts')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('group_id', groupId);

  if (deleteError) {
    console.error('[addon-assignments:drafts:delete:error]', deleteError.message);
    throw deleteError;
  }

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
    if (insertError) {
      console.error('[addon-assignments:drafts:insert:error]', insertError.message, { rows: rows.length });
      throw insertError;
    }
  }

  console.info('[addon-assignments:drafts:inserted]', { groupId, inserted: rows.length });

  const itemIds = uniqueItems.map((item) => String(item.id));

  const { data: draftGroup, error: draftGroupError } = await supabase
    .from('addon_groups_drafts')
    .select('name')
    .eq('id', groupId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (draftGroupError) {
    console.error('[addon-assignments:live:load-draft]', draftGroupError.message);
  }

  if (draftGroup?.name) {
    const { data: liveGroup, error: liveGroupError } = await supabase
      .from('addon_groups')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('name', draftGroup.name)
      .is('archived_at', null)
      .maybeSingle();

    if (liveGroupError) {
      console.error('[addon-assignments:live:load]', liveGroupError.message);
    }

    if (liveGroup?.id && itemIds.length) {
      const { error: deleteLiveError } = await supabase
        .from('item_addon_links')
        .delete()
        .eq('group_id', liveGroup.id)
        .in('item_id', itemIds);

      if (deleteLiveError) {
        console.error('[addon-assignments:live:delete]', deleteLiveError.message);
      }

      const liveRows = itemIds.map((itemId) => ({ item_id: itemId, group_id: liveGroup.id }));

      const { error: liveInsertError } = await supabase
        .from('item_addon_links')
        .upsert(liveRows, { onConflict: 'item_id,group_id' });

      if (liveInsertError) {
        console.error('[addon-assignments:live:insert]', liveInsertError.message);
      } else {
        console.info('[addon-assignments:live:saved]', { groupId: liveGroup.id, items: liveRows.length });
      }
    }
  }

  return { externalKeyMap };
}
