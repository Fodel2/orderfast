import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerClient } from '../../lib/supaServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const debugMode =
    process.env.NODE_ENV !== 'production' &&
    (req.query.debug === '1' || req.headers['x-debug'] === '1');

  let supabase;
  try {
    supabase = getServerClient();
  } catch {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { restaurantId } = req.body as { restaurantId?: string };
  if (!restaurantId) {
    return res.status(400).json({ error: 'Missing restaurantId' });
  }

  let step = '';
  let sqlOperation = '';
  try {
    step = 'loadDraft';
    sqlOperation = 'select menu_builder_drafts';
    const { data: draftRow, error: draftErr } = await supabase
      .from('menu_builder_drafts')
      .select('payload')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (draftErr) throw draftErr;
    if (!draftRow || !draftRow.payload) {
      return res.status(400).json({ error: 'NO_DRAFT' });
    }

    const draft = draftRow.payload as any;
    const categories = Array.isArray(draft.categories) ? draft.categories : [];
    const items = Array.isArray(draft.items) ? draft.items : [];

    step = 'loadExistingItems';
    sqlOperation = 'select menu_items';
    const { data: existingItems, error: existingItemsErr } = await supabase
      .from('menu_items')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null);
    if (existingItemsErr) throw existingItemsErr;
    const existingItemIds = (existingItems || []).map((r: any) => r.id);

    step = 'loadExistingCats';
    sqlOperation = 'select menu_categories';
    const { data: existingCats, error: existingCatsErr } = await supabase
      .from('menu_categories')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null);
    if (existingCatsErr) throw existingCatsErr;
    const existingCatIds = (existingCats || []).map((r: any) => r.id);

    const now = new Date().toISOString();
    let archivedItems = 0;
    let archivedCats = 0;

    if (existingItemIds.length) {
      step = 'archiveItems';
      sqlOperation = 'update menu_items';
      const { error: archItemsErr } = await supabase
        .from('menu_items')
        .update({ archived_at: now })
        .in('id', existingItemIds);
      if (archItemsErr) throw archItemsErr;
      archivedItems = existingItemIds.length;

      step = 'deleteAddonLinks';
      sqlOperation = 'delete item_addon_links';
      const { error: delLinksErr } = await supabase
        .from('item_addon_links')
        .delete()
        .in('item_id', existingItemIds);
      if (delLinksErr) throw delLinksErr;
    }

    if (existingCatIds.length) {
      step = 'archiveCategories';
      sqlOperation = 'update menu_categories';
      const { error: archCatsErr } = await supabase
        .from('menu_categories')
        .update({ archived_at: now })
        .in('id', existingCatIds);
      if (archCatsErr) throw archCatsErr;
      archivedCats = existingCatIds.length;
    }

    step = 'insertCategories';
    sqlOperation = 'insert menu_categories';
    const catIdMap = new Map<any, any>();
    let categoriesInserted = 0;
    for (const c of categories) {
      const { data: inserted, error } = await supabase
        .from('menu_categories')
        .insert({
          restaurant_id: restaurantId,
          name: c.name,
          description: c.description,
          sort_order: c.sort_order,
          image_url: c.image_url,
        })
        .select('id')
        .single();
      if (error || !inserted) throw error;
      catIdMap.set(c.id ?? c.tempId, inserted.id);
      categoriesInserted++;
    }

    step = 'insertItems';
    sqlOperation = 'insert menu_items';
    let itemsInserted = 0;
    let linksInserted = 0;
    for (const it of items) {
      const catId = it.category_id ? catIdMap.get(it.category_id) || null : null;
      const { data: inserted, error } = await supabase
        .from('menu_items')
        .insert({
          restaurant_id: restaurantId,
          name: it.name,
          description: it.description,
          price: it.price,
          image_url: it.image_url,
          is_vegetarian: it.is_vegetarian,
          is_vegan: it.is_vegan,
          is_18_plus: it.is_18_plus,
          stock_status: it.stock_status,
          available: it.available,
          sort_order: it.sort_order,
          out_of_stock_until: it.out_of_stock_until,
          stock_return_date: it.stock_return_date,
          category_id: catId,
        })
        .select('id')
        .single();
      if (error || !inserted) throw error;
      itemsInserted++;
      if (Array.isArray(it.addons)) {
        for (const gid of it.addons) {
          const { error: linkErr } = await supabase
            .from('item_addon_links')
            .insert({ item_id: inserted.id, group_id: gid });
          if (linkErr) throw linkErr;
          linksInserted++;
        }
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[publish-menu]', {
        categoriesInserted,
        itemsInserted,
        linksInserted,
        archivedCats,
        archivedItems,
      });
    }

    return res.status(200).json({
      ok: true,
      categoriesInserted,
      itemsInserted,
      linksInserted,
      archivedCats,
      archivedItems,
    });
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[publish-menu] error', err);
    }
    const body: any = { error: 'Publish failed' };
    if (debugMode) {
      body.detail = err.message;
      body.step = step;
      body.sqlOperation = sqlOperation;
    }
    return res.status(500).json(body);
  }
}

