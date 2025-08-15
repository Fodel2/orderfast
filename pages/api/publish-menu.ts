import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Missing service env', err);
    }
    return res.status(500).json({ error: 'Missing service env' });
  }

  const { restaurantId, userId } = req.body as {
    restaurantId?: string;
    userId?: string;
  };
  if (!restaurantId) {
    return res.status(400).json({ error: 'Missing restaurantId' });
  }

  try {
    let draftQuery = supabase
      .from('menu_builder_drafts')
      .select('payload')
      .eq('restaurant_id', restaurantId);
    if (userId) {
      draftQuery = draftQuery.eq('user_id', userId);
    } else {
      draftQuery = draftQuery.order('updated_at', { ascending: false }).limit(1);
    }
    const { data: draftRow, error: draftErr } = await draftQuery.maybeSingle();
    if (draftErr) throw draftErr;
    if (!draftRow || !draftRow.payload) {
      return res.status(400).json({ error: 'No draft to publish' });
    }

    const draft = draftRow.payload as any;
    const categories = Array.isArray(draft.categories) ? draft.categories : [];
    const items = Array.isArray(draft.items) ? draft.items : [];
    const itemAddonLinks = Array.isArray(draft.itemAddonLinks)
      ? draft.itemAddonLinks
      : [];
    const itemCategories = Array.isArray(draft.itemCategories)
      ? draft.itemCategories
      : [];

    const { data: existingItems, error: existingItemsErr } = await supabase
      .from('menu_items')
      .select('id')
      .eq('restaurant_id', restaurantId);
    if (existingItemsErr) throw existingItemsErr;
    const existingItemIds = (existingItems || []).map((r: any) => r.id);

    if (existingItemIds.length) {
      const { error: delLinksErr } = await supabase
        .from('item_addon_links')
        .delete()
        .in('item_id', existingItemIds);
      if (delLinksErr) throw delLinksErr;

      const { error: delItemCatsErr } = await supabase
        .from('menu_item_categories')
        .delete()
        .in('item_id', existingItemIds);
      if (delItemCatsErr) throw delItemCatsErr;
    }

    const { error: delItemsErr } = await supabase
      .from('menu_items')
      .delete()
      .eq('restaurant_id', restaurantId);
    if (delItemsErr) throw delItemsErr;

    const { error: delCatsErr } = await supabase
      .from('menu_categories')
      .delete()
      .eq('restaurant_id', restaurantId);
    if (delCatsErr) throw delCatsErr;

    const catIdMap = new Map<any, any>();
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
      catIdMap.set(c.tempId ?? c.id, inserted.id);
    }

    const itemIdMap = new Map<any, any>();
    for (const it of items) {
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
          available: it.available,
          out_of_stock_until: it.out_of_stock_until,
          sort_order: it.sort_order,
          stock_status: it.stock_status,
          stock_return_date: it.stock_return_date,
        })
        .select('id')
        .single();
      if (error || !inserted) throw error;
      itemIdMap.set(it.tempId ?? it.id, inserted.id);
    }

    for (const link of itemCategories) {
      const itemId = itemIdMap.get(link.itemTempIdOrId);
      const catId = catIdMap.get(link.categoryTempIdOrId);
      if (itemId && catId) {
        const { error } = await supabase
          .from('menu_item_categories')
          .insert({ item_id: itemId, category_id: catId });
        if (error) throw error;
      }
    }

    for (const link of itemAddonLinks) {
      const itemId = itemIdMap.get(link.itemTempIdOrId);
      const groupId = link.addonGroupId;
      if (itemId && groupId) {
        const { error } = await supabase
          .from('item_addon_links')
          .insert({ item_id: itemId, group_id: groupId });
        if (error) throw error;
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug('[publish] ok', {
        rid: restaurantId,
        categories: categories.length,
        items: items.length,
        itemAddonLinks: itemAddonLinks.length,
        itemCategories: itemCategories.length,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[publish] error', err);
    }
    return res.status(500).json({ error: err.message });
  }
}
