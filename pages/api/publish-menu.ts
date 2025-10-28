import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

function logSupabaseError(scope: string, error: any, extra?: Record<string, any>) {
  console.error(scope, {
    ...extra,
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
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

  const archivedSupport: Record<'menu_items' | 'menu_categories', boolean> = {
    menu_items: true,
    menu_categories: true,
  };

  async function withArchivedFilter(
    table: 'menu_items' | 'menu_categories',
    build: (useArchivedFilter: boolean) => PostgrestFilterBuilder<any, any, any>,
  ) {
    const useArchived = archivedSupport[table];
    const query = build(useArchived);
    const { data, error } = await query;
    if (error && error.code === '42703' && /archived_at/i.test(error.message || '')) {
      archivedSupport[table] = false;
      return await build(false);
    }
    return { data, error };
  }

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

    // Counters
    let deletedLinks = 0, deletedItems = 0, deletedCats = 0;
    let archivedLinks = 0, archivedItems = 0, archivedCats = 0;
    let insertedCats = 0, insertedItems = 0;
    let itemsUpserted = 0;
    let groupsInserted = 0;
    let optionsInserted = 0;
    let linksInserted = 0;

    // 2) Try HARD-DELETE current live data (links -> items -> categories)
    try {
      const { data: liveItems, error: liveErr } = await withArchivedFilter(
        'menu_items',
        (useArchived) => {
          const query = supabase
            .from('menu_items')
            .select('id')
            .eq('restaurant_id', restaurantId) as PostgrestFilterBuilder<any, any, any>;
          return useArchived ? query.filter('archived_at', 'is', null) : query;
        },
      );
      if (liveErr) throw liveErr;
      const liveItemIds = (liveItems ?? []).map((r: any) => r.id);

      if (liveItemIds.length > 0) {
        const { data: delLinks, error: delLinksErr } = await supabase
          .from('item_addon_links')
          .delete()
          .in('item_id', liveItemIds)
          .select('id');
        if (delLinksErr) throw delLinksErr;
        deletedLinks = delLinks?.length ?? 0;
      }

      const { data: delItems, error: delItemsErr } = await withArchivedFilter(
        'menu_items',
        (useArchived) => {
          const query = supabase
            .from('menu_items')
            .delete()
            .eq('restaurant_id', restaurantId)
            .select('id') as PostgrestFilterBuilder<any, any, any>;
          return useArchived ? query.filter('archived_at', 'is', null) : query;
        },
      );
      if (delItemsErr) throw delItemsErr;
      deletedItems = delItems?.length ?? 0;

      const { data: delCats, error: delCatsErr } = await withArchivedFilter(
        'menu_categories',
        (useArchived) => {
          const query = supabase
            .from('menu_categories')
            .delete()
            .eq('restaurant_id', restaurantId)
            .select('id') as PostgrestFilterBuilder<any, any, any>;
          return useArchived ? query.filter('archived_at', 'is', null) : query;
        },
      );
      if (delCatsErr) throw delCatsErr;
      deletedCats = delCats?.length ?? 0;

    } catch (hardDeleteErr: any) {
      // FK violation (due to order_items) → ARCHIVE instead (so customer never sees old rows)
      console.error('[publish:hardDeleteFallback]', {
        restaurantId,
        error: hardDeleteErr,
        message: hardDeleteErr?.message,
        code: hardDeleteErr?.code,
        details: hardDeleteErr?.details,
        hint: hardDeleteErr?.hint,
        stack: hardDeleteErr?.stack,
      });

      let archItemsErr;
      let archItems;
      if (archivedSupport.menu_items) {
        ({ data: archItems, error: archItemsErr } = await withArchivedFilter(
          'menu_items',
          (useArchived) => {
            const query = supabase
              .from('menu_items')
              .update({ archived_at: new Date().toISOString() })
              .eq('restaurant_id', restaurantId)
              .select('id') as PostgrestFilterBuilder<any, any, any>;
            return useArchived ? query.filter('archived_at', 'is', null) : query;
          },
        ));
        if (archItemsErr && archItemsErr.code === '42703' && /archived_at/i.test(archItemsErr.message || '')) {
          archivedSupport.menu_items = false;
        }
      }

      if ((!archItems || archItemsErr) && archivedSupport.menu_items === false) {
        const { data, error } = await supabase
          .from('menu_items')
          .update({ status: 'archived' })
          .eq('restaurant_id', restaurantId)
          .select('id');
        archItems = data;
        archItemsErr = error;
      }
      if (archItemsErr) {
        logSupabaseError('[publish:archiveItems]', archItemsErr, { restaurantId });
        return res.status(500).json({ where: 'archive_items', error: archItemsErr.message, code: archItemsErr.code, details: archItemsErr.details });
      }
      const archivedItemIds = archItems?.map((r: any) => r.id) ?? [];
      archivedItems = archivedItemIds.length;

      if (archivedItemIds.length > 0) {
        const { data: delLinks, error: delLinksErr } = await supabase
          .from('item_addon_links')
          .delete()
          .in('item_id', archivedItemIds)
          .select('id');
        if (delLinksErr) {
          logSupabaseError('[publish:deleteLinksForArchived]', delLinksErr, { restaurantId });
          return res.status(500).json({ where: 'delete_archived_links', error: delLinksErr.message, code: delLinksErr.code, details: delLinksErr.details });
        }
        archivedLinks = delLinks?.length ?? 0;
      }

      let archCatsErr;
      let archCats;
      if (archivedSupport.menu_categories) {
        ({ data: archCats, error: archCatsErr } = await withArchivedFilter(
          'menu_categories',
          (useArchived) => {
            const query = supabase
              .from('menu_categories')
              .update({ archived_at: new Date().toISOString() })
              .eq('restaurant_id', restaurantId)
              .select('id') as PostgrestFilterBuilder<any, any, any>;
            return useArchived ? query.filter('archived_at', 'is', null) : query;
          },
        ));
        if (archCatsErr && archCatsErr.code === '42703' && /archived_at/i.test(archCatsErr.message || '')) {
          archivedSupport.menu_categories = false;
        }
      }

      if ((!archCats || archCatsErr) && archivedSupport.menu_categories === false) {
        const { data, error } = await supabase
          .from('menu_categories')
          .update({ status: 'archived' })
          .eq('restaurant_id', restaurantId)
          .select('id');
        archCats = data;
        archCatsErr = error;
      }
      if (archCatsErr) {
        logSupabaseError('[publish:archiveCats]', archCatsErr, { restaurantId });
        return res.status(500).json({ where: 'archive_categories', error: archCatsErr.message, code: archCatsErr.code, details: archCatsErr.details });
      }
      archivedCats = archCats?.length ?? 0;
    }

    // 3) Insert categories (set restaurant_id explicitly; keep sort_order)
    const catIdMap = new Map<string, string>();
    for (const [idx, c] of (draft.categories ?? []).entries()) {
      const { data: inserted, error } = await supabase
        .from('menu_categories')
        .insert({
          restaurant_id: restaurantId, // schema allows, even without FK constraint
          name: c.name,
          description: c.description ?? null,
          sort_order: c.sort_order ?? idx,
          image_url: c.image_url ?? null,
        })
        .select('id')
        .single();

      if (error || !inserted) {
        logSupabaseError('[publish:insertCategory]', error, { restaurantId, payload: c });
        return res.status(500).json({ where: 'insert_category', error: error?.message || 'Insert category failed', code: error?.code, details: error?.details });
      }
      const key = (c.tempId ?? c.id) as string | undefined;
      if (key) catIdMap.set(key, inserted.id);
      insertedCats++;
    }

    // 4) Insert items (map category_id if provided; allow null if schema allows)
    const externalKeyToItemId = new Map<string, string>();
    let draftMutated = false;
    for (const [idx, it] of (draft.items ?? []).entries()) {
      const mappedCat = it.category_id ? (catIdMap.get(it.category_id) ?? null) : null;

      let externalKey = typeof it.external_key === 'string' && it.external_key ? it.external_key : undefined;
      if (!externalKey) {
        externalKey = randomUUID();
        draftMutated = true;
        it.external_key = externalKey;
      }

      const { data: inserted, error } = await supabase
        .from('menu_items')
        .insert({
          restaurant_id: restaurantId,
          category_id: mappedCat, // schema shows nullable
          name: it.name,
          description: it.description ?? null,
          price: it.price ?? null,
          image_url: it.image_url ?? null,
          sort_order: it.sort_order ?? idx,
          external_key: externalKey,
        })
        .select('id,external_key')
        .single();

      if (error || !inserted) {
        logSupabaseError('[publish:insertItem]', error, { restaurantId, payload: it });
        return res.status(500).json({ where: 'insert_item', error: error?.message || 'Insert item failed', code: error?.code, details: error?.details });
      }
      if (externalKey) externalKeyToItemId.set(externalKey, inserted.id);
      insertedItems++;
      itemsUpserted++;
    }

    if (draftMutated) {
      const { error: draftUpdateErr } = await supabase
        .from('menu_drafts')
        .update({ draft })
        .eq('restaurant_id', restaurantId);
      if (draftUpdateErr) {
        logSupabaseError('[publish:updateDraftExternalKeys]', draftUpdateErr, { restaurantId });
        return res.status(500).json({ where: 'update_draft_external_keys', error: draftUpdateErr.message, code: draftUpdateErr.code, details: draftUpdateErr.details });
      }
    }

    // 5) Publish add-on groups and options from drafts
    const { data: draftGroups, error: draftGroupsErr } = await supabase
      .from('addon_groups_drafts')
      .select('id,name,required,multiple_choice,max_group_select,max_option_quantity')
      .eq('restaurant_id', restaurantId);
    if (draftGroupsErr) {
      logSupabaseError('[publish:loadAddonGroupsDrafts]', draftGroupsErr, { restaurantId });
      return res.status(500).json({ where: 'load_addon_groups_drafts', error: draftGroupsErr.message, code: draftGroupsErr.code, details: draftGroupsErr.details });
    }

    const draftGroupIds = (draftGroups ?? []).map((g: any) => g.id);

    const nowIso = new Date().toISOString();

    const { error: archiveOptionsErr } = await supabase
      .from('addon_options')
      .update({ archived_at: nowIso })
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null);
    if (archiveOptionsErr) {
      logSupabaseError('[publish:archiveLiveAddonOptions]', archiveOptionsErr, { restaurantId });
      return res
        .status(500)
        .json({ where: 'archive_live_addon_options', error: archiveOptionsErr.message, code: archiveOptionsErr.code, details: archiveOptionsErr.details });
    }

    const { error: archiveGroupsErr } = await supabase
      .from('addon_groups')
      .update({ archived_at: nowIso })
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null);
    if (archiveGroupsErr) {
      logSupabaseError('[publish:archiveLiveAddonGroups]', archiveGroupsErr, { restaurantId });
      return res
        .status(500)
        .json({ where: 'archive_live_addon_groups', error: archiveGroupsErr.message, code: archiveGroupsErr.code, details: archiveGroupsErr.details });
    }

    if (draftGroupIds.length > 0) {
      const { data: draftOptions, error: draftOptionsErr } = await supabase
        .from('addon_options_drafts')
        .select(
          'id,group_id,name,price,available,out_of_stock_until,stock_status,stock_return_date,stock_last_updated_at'
        )
        .in('group_id', draftGroupIds);
      if (draftOptionsErr) {
        logSupabaseError('[publish:loadAddonOptionsDrafts]', draftOptionsErr, { restaurantId });
        return res.status(500).json({ where: 'load_addon_options_drafts', error: draftOptionsErr.message, code: draftOptionsErr.code, details: draftOptionsErr.details });
      }

      const groupIdMap = new Map<string, string>();
      for (const group of draftGroups ?? []) {
        const payload = {
          restaurant_id: restaurantId,
          name: group.name,
          required: group.required,
          multiple_choice: group.multiple_choice,
          max_group_select: group.max_group_select,
          max_option_quantity: group.max_option_quantity,
        };
        const { data: insertedGroup, error: insertGroupErr } = await supabase
          .from('addon_groups')
          .insert({ ...payload, archived_at: null })
          .select('id')
          .single();
        if (insertGroupErr || !insertedGroup) {
          logSupabaseError('[publish:insertAddonGroup]', insertGroupErr, { restaurantId, payload: group });
          return res.status(500).json({ where: 'insert_addon_group', error: insertGroupErr?.message || 'insert_group_failed', code: insertGroupErr?.code, details: insertGroupErr?.details });
        }
        groupIdMap.set(String(group.id), insertedGroup.id);
        groupsInserted++;
      }

      const optionPayload: any[] = [];
      for (const opt of draftOptions ?? []) {
        const liveGroupId = groupIdMap.get(String(opt.group_id));
        if (!liveGroupId) continue;
        optionPayload.push({
          group_id: liveGroupId,
          name: opt.name,
          price: opt.price,
          available: opt.available,
          out_of_stock_until: opt.out_of_stock_until,
          stock_status: opt.stock_status,
          stock_return_date: opt.stock_return_date,
          stock_last_updated_at: opt.stock_last_updated_at,
          archived_at: null,
        });
      }

      if (optionPayload.length > 0) {
        const { data: insertedOptions, error: insertOptionsErr } = await supabase
          .from('addon_options')
          .insert(optionPayload)
          .select('id');
        if (insertOptionsErr) {
          logSupabaseError('[publish:insertAddonOptions]', insertOptionsErr, { restaurantId });
          return res.status(500).json({ where: 'insert_addon_options', error: insertOptionsErr.message, code: insertOptionsErr.code, details: insertOptionsErr.details });
        }
        optionsInserted = insertedOptions?.length ?? optionPayload.length;
      }

        const { data: draftLinks, error: draftLinksErr } = await supabase
          .from('item_addon_links_drafts')
          .select('item_external_key,group_id')
          .eq('restaurant_id', restaurantId);
      if (draftLinksErr) {
        logSupabaseError('[publish:loadAddonLinksDrafts]', draftLinksErr, { restaurantId });
        return res.status(500).json({ where: 'load_addon_links_drafts', error: draftLinksErr.message, code: draftLinksErr.code, details: draftLinksErr.details });
      }

      const linkRows: Array<{ item_id: string; group_id: string }> = [];
        for (const link of draftLinks ?? []) {
          const itemKey = link.item_external_key;
          const draftGroupId = link.group_id;
        if (!itemKey || !draftGroupId) continue;
        const liveItemId = externalKeyToItemId.get(String(itemKey));
        const liveGroupId = groupIdMap.get(String(draftGroupId));
        if (!liveItemId || !liveGroupId) continue;
        linkRows.push({ item_id: liveItemId, group_id: liveGroupId });
      }

      if (linkRows.length > 0) {
        const { data: insertedLinkRows, error: insertLinksErr } = await supabase
          .from('item_addon_links')
          .upsert(linkRows, { onConflict: 'item_id,group_id', ignoreDuplicates: true })
          .select('id');
        if (insertLinksErr) {
          logSupabaseError('[publish:insertAddonLinks]', insertLinksErr, { restaurantId });
          return res.status(500).json({ where: 'insert_addon_links', error: insertLinksErr.message, code: insertLinksErr.code, details: insertLinksErr.details });
        }
        linksInserted = insertedLinkRows?.length ?? linkRows.length;

        const sampleLink = linkRows[0];
        const { data: validationRows, error: validationErr } = await supabase
          .from('item_addon_links')
          .select('id')
          .eq('item_id', sampleLink.item_id)
          .limit(1);
        if (validationErr) {
          logSupabaseError('[publish:validateAddonLinks]', validationErr, { restaurantId, sampleLink });
          return res.status(500).json({ where: 'validate_addon_links', error: validationErr.message, code: validationErr.code, details: validationErr.details });
        }
        if ((validationRows ?? []).length === 0) {
          console.error('[publish:validateAddonLinks]', {
            restaurantId,
            sampleLink,
            message: 'No live links found after publish validation',
          });
          return res.status(500).json({ where: 'validate_addon_links', error: 'addon_link_validation_failed' });
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        console.info('[publish:addon-link-remap]', {
          restaurantId,
          sample: linkRows.slice(0, 3),
        });
        console.info('[publish:addon-counts]', {
          restaurantId,
          counts: {
            groups: groupsInserted,
            options: optionsInserted,
            links: linksInserted,
          },
        });
      }
    }

    const publishCounts = {
      items_upserted: itemsUpserted,
      groups_inserted: groupsInserted,
      options_inserted: optionsInserted,
      links_inserted: linksInserted,
    };

    return res.status(200).json({
      deleted:  { categories: deletedCats, items: deletedItems, links: deletedLinks },
      archived: { categories: archivedCats, items: archivedItems, links: archivedLinks },
      inserted: { categories: insertedCats, items: insertedItems, links: linksInserted },
      publish: publishCounts,
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

