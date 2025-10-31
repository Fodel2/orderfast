import { randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

type SupabaseError = { message?: string; code?: string; details?: string; hint?: string } & Record<string, any>;

function logSupabaseError(scope: string, error: SupabaseError | null, extra?: Record<string, any>) {
  if (!error) return;
  console.error(scope, {
    ...extra,
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    error,
  });
}

type DraftPayload = {
  categories: Array<{ id?: string; tempId?: string; name: string; description?: string|null; sort_order?: number; image_url?: string|null }>;
  items: Array<{
    id?: string; tempId?: string; name: string; description?: string|null; price?: number|null;
    image_url?: string|null; is_vegetarian?: boolean; is_vegan?: boolean; is_18_plus?: boolean;
    stock_status?: string|null; available?: boolean; category_id?: string; sort_order?: number;
    external_key?: string;
    addons?: string[];
  }>;
  links?: Array<{ item_id: string; group_id: string }>; // IMPORTANT: group_id
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  const supabase = supaServer;
  let restaurantId: string | undefined;

  try {
    ({ restaurantId } = req.body as { restaurantId?: string });
    if (!restaurantId) return res.status(400).json({ error: 'restaurantId is required' });

    // 1) Load draft
    const { data: draftRow, error: loadErr } = await supabase
      .from('menu_drafts')
      .select('draft')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (loadErr) {
      logSupabaseError('[publish:loadDraft]', loadErr, { restaurantId });
      return res.status(500).json({ where: 'load_draft', error: loadErr.message, code: loadErr.code, details: loadErr.details });
    }
    const draft = draftRow?.draft as DraftPayload | undefined;
    if (!draft) return res.status(400).json({ error: 'No draft to publish' });

    const nowIso = new Date().toISOString();

    const stats = {
      categories_upserted: 0,
      items_upserted: 0,
      item_external_keys_mapped: 0,
      addon_groups_inserted: 0,
      addon_options_inserted: 0,
      addon_links_inserted: 0,
      draft_links_updated: 0,
    };

    // 2) Upsert categories
    const categoryIdMap = new Map<string, string>();
    const categoryRecords = (draft.categories ?? []).map((category, index) => {
      const stableId = category.id || category.tempId || randomUUID();
      categoryIdMap.set(category.tempId ?? category.id ?? stableId, stableId);
      return {
        id: stableId,
        restaurant_id: restaurantId,
        name: category.name,
        description: category.description ?? null,
        sort_order: category.sort_order ?? index,
        image_url: category.image_url ?? null,
        archived_at: null,
        updated_at: nowIso,
      };
    });

    if (categoryRecords.length > 0) {
      const { data: categoryResult, error: categoryError } = await supabase
        .from('menu_categories')
        .upsert(categoryRecords, { onConflict: 'id' })
        .select('id');

      if (categoryError) {
        logSupabaseError('[publish:upsertCategories]', categoryError, { restaurantId });
        return res.status(500).json({
          where: 'upsert_categories',
          error: categoryError.message,
          code: categoryError.code,
          details: categoryError.details,
        });
      }

      stats.categories_upserted = categoryResult?.length ?? 0;
    }

    // 3) Upsert menu items using external key
    let draftMutated = false;
    const itemExternalKeys: string[] = [];
    const itemRecords = (draft.items ?? []).map((item, index) => {
      let externalKey = item.external_key?.trim();
      if (!externalKey) {
        externalKey = randomUUID();
        draftMutated = true;
        item.external_key = externalKey;
      }
      itemExternalKeys.push(externalKey);

      const baseRecord: Record<string, any> = {
        restaurant_id: restaurantId,
        external_key: externalKey,
        name: item.name,
        description: item.description ?? null,
        price: item.price ?? null,
        image_url: item.image_url ?? null,
        sort_order: item.sort_order ?? index,
        archived_at: null,
        updated_at: nowIso,
        category_id: item.category_id ? categoryIdMap.get(item.category_id) ?? item.category_id : null,
      };

      if (item.id) {
        baseRecord.id = item.id;
      }

      return baseRecord;
    });

    let itemUpsertResult: Array<{ id: string; external_key: string }> = [];
    if (itemRecords.length > 0) {
      const { data: upsertedItems, error: itemsError } = await supabase
        .from('menu_items')
        .upsert(itemRecords, { onConflict: 'restaurant_id,external_key' })
        .select('id,external_key');

      if (itemsError) {
        logSupabaseError('[publish:upsertItems]', itemsError, { restaurantId });
        return res.status(500).json({
          where: 'upsert_items',
          error: itemsError.message,
          code: itemsError.code,
          details: itemsError.details,
        });
      }

      itemUpsertResult = upsertedItems ?? [];
      stats.items_upserted = itemUpsertResult.length;
    }

    // ensure mapping for every external key we touched
    const itemIdByExternalKey = new Map<string, string>();
    for (const row of itemUpsertResult) {
      if (row?.external_key) {
        itemIdByExternalKey.set(row.external_key, String(row.id));
      }
    }

    if (itemIdByExternalKey.size < itemExternalKeys.length) {
      const { data: existingItems, error: existingErr } = await supabase
        .from('menu_items')
        .select('id,external_key')
        .eq('restaurant_id', restaurantId)
        .in('external_key', itemExternalKeys);

      if (existingErr) {
        logSupabaseError('[publish:fetchItemsForMap]', existingErr, { restaurantId });
        return res.status(500).json({
          where: 'fetch_items_for_map',
          error: existingErr.message,
          code: existingErr.code,
          details: existingErr.details,
        });
      }

      for (const row of existingItems ?? []) {
        if (row?.external_key) {
          itemIdByExternalKey.set(String(row.external_key), String(row.id));
        }
      }
    }

    stats.item_external_keys_mapped = itemIdByExternalKey.size;

    if (draftMutated) {
      const { error: draftUpdateErr } = await supabase
        .from('menu_drafts')
        .update({ draft })
        .eq('restaurant_id', restaurantId);
      if (draftUpdateErr) {
        logSupabaseError('[publish:updateDraftExternalKeys]', draftUpdateErr, { restaurantId });
        return res.status(500).json({
          where: 'update_draft_external_keys',
          error: draftUpdateErr.message,
          code: draftUpdateErr.code,
          details: draftUpdateErr.details,
        });
      }
    }

    // 4) Ensure draft links carry an external key for publish mapping
    const { data: draftLinksNeedingKey, error: draftLinksErr } = await supabase
      .from('item_addon_links_drafts')
      .select('id,item_id,item_external_key')
      .eq('restaurant_id', restaurantId)
      .is('item_external_key', null);

    if (draftLinksErr) {
      logSupabaseError('[publish:fetchDraftLinksNeedingKey]', draftLinksErr, { restaurantId });
      return res.status(500).json({
        where: 'fetch_draft_links_missing_key',
        error: draftLinksErr.message,
        code: draftLinksErr.code,
        details: draftLinksErr.details,
      });
    }

    if ((draftLinksNeedingKey?.length ?? 0) > 0) {
      const linkItemIds = Array.from(
        new Set(
          (draftLinksNeedingKey ?? [])
            .map((link) => link.item_id)
            .filter(Boolean)
            .map(String),
        ),
      );

      let itemLookup: Record<string, string> = {};
      if (linkItemIds.length > 0) {
        const { data: menuItemRows, error: menuItemErr } = await supabase
          .from('menu_items')
          .select('id,external_key')
          .eq('restaurant_id', restaurantId)
          .in('id', linkItemIds);

        if (menuItemErr) {
          logSupabaseError('[publish:fetchItemsForDraftLinks]', menuItemErr, { restaurantId });
          return res.status(500).json({
            where: 'fetch_items_for_draft_links',
            error: menuItemErr.message,
            code: menuItemErr.code,
            details: menuItemErr.details,
          });
        }

        itemLookup = Object.fromEntries(
          (menuItemRows ?? [])
            .filter((row) => row?.id && row?.external_key)
            .map((row) => [String(row.id), String(row.external_key)]),
        );
      }

      const updates = (draftLinksNeedingKey ?? [])
        .map((link) => {
          if (!link?.id || !link?.item_id) return undefined;
          const externalKey = itemLookup[String(link.item_id)];
          if (!externalKey) return undefined;
          return { id: link.id, item_external_key: externalKey };
        })
        .filter(Boolean) as Array<{ id: string; item_external_key: string }>;

      if (updates.length > 0) {
        const { error: updateLinksErr, data: updatedLinks } = await supabase
          .from('item_addon_links_drafts')
          .upsert(updates, { onConflict: 'id' })
          .select('id');

        if (updateLinksErr) {
          logSupabaseError('[publish:updateDraftLinksExternalKey]', updateLinksErr, { restaurantId });
          return res.status(500).json({
            where: 'update_draft_links_external_key',
            error: updateLinksErr.message,
            code: updateLinksErr.code,
            details: updateLinksErr.details,
          });
        }

        stats.draft_links_updated = updatedLinks?.length ?? 0;
      }
    }

    // 5) Publish add-on groups, options, and links via transactional helper
    const { data: publishAddonRows, error: publishAddonsError } = await supabase.rpc(
      'publish_addons_from_drafts',
      { p_restaurant_id: restaurantId }
    );

    if (publishAddonsError) {
      logSupabaseError('[publish:addons:rpc]', publishAddonsError, { restaurantId });
      return res.status(500).json({
        where: 'publish_addons_from_drafts',
        error: publishAddonsError.message,
        code: publishAddonsError.code,
        details: publishAddonsError.details,
      });
    }

    const publishAddonResult = Array.isArray(publishAddonRows)
      ? publishAddonRows[0]
      : publishAddonRows;
    stats.addon_groups_inserted = publishAddonResult?.groups_inserted ?? 0;
    stats.addon_options_inserted = publishAddonResult?.options_inserted ?? 0;

    // 6) Remap draft item->group links to live equivalents using external keys and group names
    const { data: draftGroups, error: draftGroupsErr } = await supabase
      .from('addon_groups_drafts')
      .select('id,name')
      .eq('restaurant_id', restaurantId)
      .or('state.is.null,state.eq.draft')
      .is('archived_at', null);

    if (draftGroupsErr) {
      logSupabaseError('[publish:loadDraftGroups]', draftGroupsErr, { restaurantId });
      return res.status(500).json({
        where: 'load_draft_groups',
        error: draftGroupsErr.message,
        code: draftGroupsErr.code,
        details: draftGroupsErr.details,
      });
    }

    const draftGroupNameById = new Map<string, string>();
    for (const group of draftGroups ?? []) {
      if (group?.id && group?.name) {
        draftGroupNameById.set(String(group.id), String(group.name));
      }
    }

    const { data: liveGroups, error: liveGroupsErr } = await supabase
      .from('addon_groups')
      .select('id,name')
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null);

    if (liveGroupsErr) {
      logSupabaseError('[publish:loadLiveGroups]', liveGroupsErr, { restaurantId });
      return res.status(500).json({
        where: 'load_live_groups',
        error: liveGroupsErr.message,
        code: liveGroupsErr.code,
        details: liveGroupsErr.details,
      });
    }

    const liveGroupIdByName = new Map<string, string>();
    for (const group of liveGroups ?? []) {
      if (group?.id && group?.name) {
        liveGroupIdByName.set(String(group.name), String(group.id));
      }
    }

    const { data: draftLinks, error: draftLinksLoadErr } = await supabase
      .from('item_addon_links_drafts')
      .select('group_id,item_external_key')
      .eq('restaurant_id', restaurantId)
      .or('state.is.null,state.eq.draft')
      .is('archived_at', null);

    if (draftLinksLoadErr) {
      logSupabaseError('[publish:loadDraftLinks]', draftLinksLoadErr, { restaurantId });
      return res.status(500).json({
        where: 'load_draft_links',
        error: draftLinksLoadErr.message,
        code: draftLinksLoadErr.code,
        details: draftLinksLoadErr.details,
      });
    }

    const { data: existingLiveLinks, error: existingLinksErr } = await supabase
      .from('item_addon_links')
      .select('item_id,group_id,addon_groups!inner(id,restaurant_id)')
      .eq('addon_groups.restaurant_id', restaurantId);

    if (existingLinksErr) {
      logSupabaseError('[publish:loadExistingLinks]', existingLinksErr, { restaurantId });
      return res.status(500).json({
        where: 'load_existing_links',
        error: existingLinksErr.message,
        code: existingLinksErr.code,
        details: existingLinksErr.details,
      });
    }

    const existingPairs = new Set<string>();
    for (const link of existingLiveLinks ?? []) {
      const itemId = link?.item_id ? String(link.item_id) : undefined;
      const groupId = link?.group_id ? String(link.group_id) : undefined;
      const restaurantScope = (link as any)?.addon_groups?.restaurant_id
        ? String((link as any).addon_groups.restaurant_id)
        : undefined;
      if (itemId && groupId && restaurantScope === restaurantId) {
        existingPairs.add(`${itemId}:${groupId}`);
      }
    }

    const linkInserts: Array<{ id: string; item_id: string; group_id: string }> = [];
    for (const draftLink of draftLinks ?? []) {
      const draftGroupId = draftLink?.group_id ? String(draftLink.group_id) : undefined;
      const draftGroupName = draftGroupId ? draftGroupNameById.get(draftGroupId) : undefined;
      if (!draftGroupName) continue;

      const liveGroupId = liveGroupIdByName.get(draftGroupName);
      if (!liveGroupId) continue;

      const itemExternalKey = draftLink?.item_external_key ? String(draftLink.item_external_key) : undefined;
      if (!itemExternalKey) continue;

      const liveItemId = itemIdByExternalKey.get(itemExternalKey);
      if (!liveItemId) continue;

      const pairKey = `${liveItemId}:${liveGroupId}`;
      if (existingPairs.has(pairKey)) continue;

      existingPairs.add(pairKey);
      linkInserts.push({ id: randomUUID(), item_id: liveItemId, group_id: liveGroupId });
    }

    if (linkInserts.length > 0) {
      const { data: insertedLinks, error: insertLinksErr } = await supabase
        .from('item_addon_links')
        .upsert(linkInserts, { onConflict: 'item_id,group_id', ignoreDuplicates: true })
        .select('id');

      if (insertLinksErr) {
        logSupabaseError('[publish:insertLinks]', insertLinksErr, { restaurantId, attempted: linkInserts.length });
        return res.status(500).json({
          where: 'insert_links',
          error: insertLinksErr.message,
          code: insertLinksErr.code,
          details: insertLinksErr.details,
        });
      }

      stats.addon_links_inserted = insertedLinks?.length ?? 0;
      console.info('[publish:links]', { restaurantId, attempted: linkInserts.length, inserted: stats.addon_links_inserted });
    } else {
      stats.addon_links_inserted = 0;
      console.info('[publish:links]', { restaurantId, attempted: 0, inserted: 0 });
    }

    return res.status(200).json({
      restaurantId,
      stats,
    });

  } catch (e: any) {
    console.error('[publish:unhandled]', {
      restaurantId,
      error: e,
      message: e?.message,
      code: e?.code,
      details: e?.details,
      hint: e?.hint,
      stack: e?.stack,
    });
    return res.status(500).json({ where: 'unhandled', error: e?.message || 'server_error' });
  }
}

