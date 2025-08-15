import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '../../lib/supabaseServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let supabase;
  try {
    supabase = supabaseServer();
  } catch {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const { restaurant_id } = req.body as { restaurant_id?: string };
  if (!restaurant_id) {
    return res.status(400).json({ error: 'Missing restaurant_id' });
  }

  try {
    const { data: draftRow, error: draftErr } = await supabase
      .from('menu_builder_drafts')
      .select('payload')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();
    if (draftErr) throw draftErr;
    if (!draftRow || !draftRow.payload) {
      return res.status(400).json({ error: 'No draft' });
    }

    const draft = draftRow.payload as any;
    const categories = Array.isArray(draft.categories) ? draft.categories : [];
    const items = Array.isArray(draft.items) ? draft.items : [];

    const { data: existingItems, error: existingItemsErr } = await supabase
      .from('menu_items')
      .select('id')
      .eq('restaurant_id', restaurant_id);
    if (existingItemsErr) throw existingItemsErr;
    const existingItemIds = (existingItems || []).map((r: any) => r.id);
    if (existingItemIds.length) {
      const { error: delLinksErr } = await supabase
        .from('item_addon_links')
        .delete()
        .in('item_id', existingItemIds);
      if (delLinksErr) throw delLinksErr;
    }

    const { error: delItemsErr } = await supabase
      .from('menu_items')
      .delete()
      .eq('restaurant_id', restaurant_id);
    if (delItemsErr) throw delItemsErr;

    const { error: delCatsErr } = await supabase
      .from('menu_categories')
      .delete()
      .eq('restaurant_id', restaurant_id);
    if (delCatsErr) throw delCatsErr;

    const catIdMap = new Map<any, any>();
    for (const c of categories) {
      const { data: inserted, error } = await supabase
        .from('menu_categories')
        .insert({
          restaurant_id,
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

    let linksInserted = 0;
    for (const it of items) {
      const catId = it.category_id ? catIdMap.get(it.category_id) || null : null;
      const { data: inserted, error } = await supabase
        .from('menu_items')
        .insert({
          restaurant_id,
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
          category_id: catId,
        })
        .select('id')
        .single();
      if (error || !inserted) throw error;
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

    if (process.env.NODE_ENV === 'development') {
      console.debug('[publish]', {
        rid: restaurant_id,
        categories: categories.length,
        items: items.length,
        links: linksInserted,
      });
    }

    return res.status(200).json({
      categoriesInserted: categories.length,
      itemsInserted: items.length,
      linksInserted,
    });
  } catch (err) {
    console.error('[publish] error', err);
    return res.status(500).json({ error: 'Publish failed' });
  }
}

