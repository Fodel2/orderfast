import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

type DraftPayload = {
  categories: Array<{ id?: string; tempId?: string; name: string; description?: string|null; sort_order?: number; image_url?: string|null }>;
  items: Array<{
    id?: string; tempId?: string; name: string; description?: string|null; price?: number|null;
    image_url?: string|null; is_vegetarian?: boolean; is_vegan?: boolean; is_18_plus?: boolean;
    stock_status?: string|null; available?: boolean; category_id?: string; sort_order?: number
  }>;
  links?: Array<{ item_id: string; group_id: string }>; // IMPORTANT: group_id
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  const supabase = supaServer();

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
    const { restaurantId } = req.body as { restaurantId?: string };
    if (!restaurantId) return res.status(400).json({ error: 'restaurantId is required' });

    // 1) Load draft
    const { data: draftRow, error: loadErr } = await supabase
      .from('menu_builder_drafts')
      .select('payload')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (loadErr) {
      console.error('[publish:loadDraft]', loadErr);
      return res.status(500).json({ where: 'load_draft', error: loadErr.message, code: loadErr.code, details: loadErr.details });
    }
    const draft = draftRow?.payload as DraftPayload | undefined;
    if (!draft) return res.status(400).json({ error: 'No draft to publish' });

    // Counters
    let deletedLinks = 0, deletedItems = 0, deletedCats = 0;
    let archivedLinks = 0, archivedItems = 0, archivedCats = 0;
    let insertedCats = 0, insertedItems = 0, insertedLinks = 0;

    // 2) Try HARD-DELETE current live data (links -> items -> categories)
    try {
      const { data: liveItems, error: liveErr } = await withArchivedFilter(
        'menu_items',
        (useArchived) => {
          const query = supabase
            .from('menu_items')
            .select('id')
            .eq('restaurant_id', restaurantId);
          return useArchived ? query.is('archived_at', null) : query;
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
            .select('id');
          return useArchived ? query.is('archived_at', null) : query;
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
            .select('id');
          return useArchived ? query.is('archived_at', null) : query;
        },
      );
      if (delCatsErr) throw delCatsErr;
      deletedCats = delCats?.length ?? 0;

    } catch (hardDeleteErr: any) {
      // FK violation (due to order_items) → ARCHIVE instead (so customer never sees old rows)
      console.error('[publish:hardDeleteFallback]', hardDeleteErr);

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
              .select('id');
            return useArchived ? query.is('archived_at', null) : query;
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
        console.error('[publish:archiveItems]', archItemsErr);
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
          console.error('[publish:deleteLinksForArchived]', delLinksErr);
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
              .select('id');
            return useArchived ? query.is('archived_at', null) : query;
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
        console.error('[publish:archiveCats]', archCatsErr);
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
        console.error('[publish:insertCategory]', error);
        return res.status(500).json({ where: 'insert_category', error: error?.message || 'Insert category failed', code: error?.code, details: error?.details });
      }
      const key = (c.tempId ?? c.id) as string | undefined;
      if (key) catIdMap.set(key, inserted.id);
      insertedCats++;
    }

    // 4) Insert items (map category_id if provided; allow null if schema allows)
    const itemIdMap = new Map<string, string>();
    for (const [idx, it] of (draft.items ?? []).entries()) {
      const mappedCat = it.category_id ? (catIdMap.get(it.category_id) ?? null) : null;

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
        })
        .select('id')
        .single();

      if (error || !inserted) {
        console.error('[publish:insertItem]', error);
        return res.status(500).json({ where: 'insert_item', error: error?.message || 'Insert item failed', code: error?.code, details: error?.details });
      }
      const key = (it.tempId ?? it.id) as string | undefined;
      if (key) itemIdMap.set(key, inserted.id);
      insertedItems++;
    }

    // 5) Insert item_addon_links (schema uses group_id)
    for (const l of (draft.links ?? [])) {
      const newItemId = itemIdMap.get(l.item_id) || l.item_id;
      if (!newItemId || !l.group_id) continue;
      const { error } = await supabase
        .from('item_addon_links')
        .insert({ item_id: newItemId, group_id: l.group_id });
      if (error) {
        console.error('[publish:insertLink]', error);
        return res.status(500).json({ where: 'insert_link', error: error.message, code: error.code, details: error.details });
      }
      insertedLinks++;
    }

    return res.status(200).json({
      deleted:  { categories: deletedCats, items: deletedItems, links: deletedLinks },
      archived: { categories: archivedCats, items: archivedItems, links: archivedLinks },
      inserted: { categories: insertedCats, items: insertedItems, links: insertedLinks },
    });

  } catch (e: any) {
    console.error('[publish:unhandled]', e);
    return res.status(500).json({ where: 'unhandled', error: e?.message || 'server_error' });
  }
}

