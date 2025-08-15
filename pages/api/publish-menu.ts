import type { NextApiRequest, NextApiResponse } from 'next';
import { supaService } from '../../utils/supabaseServer';

const supabase = supaService();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { restaurantId } = req.body as { restaurantId?: string };
  if (!restaurantId) {
    return res.status(400).json({ error: 'Missing restaurantId' });
  }

  try {
    // Load draft
    const { data: draftRow } = await supabase
      .from('menu_builder_drafts')
      .select('payload')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (!draftRow || !draftRow.payload) {
      return res.status(400).json({ error: 'No draft' });
    }

    const draft = draftRow.payload as any;
    const categories = Array.isArray(draft.categories) ? draft.categories : [];
    const items = Array.isArray(draft.items) ? draft.items : [];
    if (categories.length === 0 && items.length === 0) {
      return res.status(400).json({ error: 'Draft is empty' });
    }

    // Archive existing live rows
    const { data: archivedItemRows, error: archItemErr } = await supabase
      .from('menu_items')
      .update({ archived_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null)
      .select('id');
    if (archItemErr) throw archItemErr;
    const archivedItemIds = (archivedItemRows || []).map((r) => r.id);
    const archivedItems = archivedItemIds.length;

    const { data: archivedCatRows, error: archCatErr } = await supabase
      .from('menu_categories')
      .update({ archived_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null)
      .select('id');
    if (archCatErr) throw archCatErr;
    const archivedCats = archivedCatRows?.length || 0;

    let deletedLinks = 0;
    if (archivedItemIds.length > 0) {
      const { data: delLinkRows, error: delLinkErr } = await supabase
        .from('item_addon_links')
        .delete()
        .in('item_id', archivedItemIds)
        .select('id');
      if (delLinkErr) throw delLinkErr;
      deletedLinks = delLinkRows?.length || 0;
    }

    // Insert categories
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
          archived_at: null,
        })
        .select('id')
        .single();
      if (error || !inserted) throw error;
      catIdMap.set(c.tempId ?? c.id, inserted.id);
      categoriesInserted++;
    }

    // Insert items
    const itemIdMap = new Map<any, any>();
    let itemsInserted = 0;
    let linksInserted = 0;
    for (const it of items) {
      const catTemp = it.categoryTempId ?? it.category_id;
      const category_id = catIdMap.get(catTemp);
      if (!category_id) continue;
      const { data: inserted, error } = await supabase
        .from('menu_items')
        .insert({
          restaurant_id: restaurantId,
          category_id,
          name: it.name,
          description: it.description,
          price: it.price,
          image_url: it.image_url,
          is_vegetarian: it.is_vegetarian,
          is_vegan: it.is_vegan,
          is_18_plus: it.is_18_plus,
          available: it.available,
          sort_order: it.sort_order,
          archived_at: null,
        })
        .select('id')
        .single();
      if (error || !inserted) throw error;
      itemIdMap.set(it.tempId ?? it.id, inserted.id);
      itemsInserted++;

      const groupIds = Array.isArray(it.addon_group_ids) ? it.addon_group_ids : [];
      if (groupIds.length > 0) {
        for (const gid of groupIds) {
          const { error: linkErr } = await supabase
            .from('item_addon_links')
            .insert({ item_id: inserted.id, group_id: gid });
          if (linkErr) throw linkErr;
          linksInserted++;
        }
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug('[publish] result', {
        rid: restaurantId,
        archivedCats,
        archivedItems,
        deletedLinks,
        categoriesInserted,
        itemsInserted,
        linksInserted,
      });
    }

    return res.status(200).json({
      archivedCats,
      archivedItems,
      deletedLinks,
      categoriesInserted,
      itemsInserted,
      linksInserted,
    });
  } catch (err: any) {
    console.error('[publish] error', err);
    return res.status(500).json({ error: err.message });
  }
}
