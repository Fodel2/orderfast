import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const supabaseUser = createServerSupabaseClient({ req, res });
    const {
      data: { session },
    } = await supabaseUser.auth.getSession();
    if (!session) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const { restaurantId } = req.body as { restaurantId?: string };
    if (!restaurantId) {
      return res.status(400).json({ error: 'Missing restaurantId' });
    }

    const serviceKey =
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return res.status(500).json({ error: 'Service key not configured' });
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    );

    const { data: draftRow } = await supabase
      .from('menu_builder_drafts')
      .select('draft')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (!draftRow || !draftRow.draft) {
      return res.status(400).json({ error: 'No draft' });
    }

    const draft = draftRow.draft as any;
    const categories = Array.isArray(draft.categories) ? draft.categories : [];
    const items = Array.isArray(draft.items) ? draft.items : [];

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[publish] rid', restaurantId, 'cats', categories.length, 'items', items.length);
    }

    let deletedCats = 0;
    let deletedItems = 0;
    let deletedLinks = 0;

    const { data: liveItems, error: liveErr } = await supabase
      .from('menu_items')
      .select('id')
      .eq('restaurant_id', restaurantId);
    if (liveErr) return res.status(500).json({ error: liveErr.message });
    const liveItemIds = (liveItems || []).map((r: any) => r.id);

    if (liveItemIds.length) {
      const { error: detachErr } = await supabase
        .from('order_items')
        .update({ item_id: null })
        .in('item_id', liveItemIds);
      if (detachErr) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[publish] detach err', detachErr);
        }
        return res.status(500).json({ error: detachErr.message });
      }
      const { error: delLinksErr, count: delLinksCount } = await supabase
        .from('item_addon_links')
        .delete()
        .in('item_id', liveItemIds)
        .select('id', { count: 'exact' });
      if (delLinksErr) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[publish] del links err', delLinksErr);
        }
        return res.status(500).json({ error: delLinksErr.message });
      }
      deletedLinks = delLinksCount || 0;
    }

    const { error: delItemsErr, count: delItemsCount } = await supabase
      .from('menu_items')
      .delete()
      .eq('restaurant_id', restaurantId)
      .select('id', { count: 'exact' });
    if (delItemsErr) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[publish] del items err', delItemsErr);
      }
      return res.status(500).json({ error: delItemsErr.message });
    }
    deletedItems = delItemsCount || 0;

    const { error: delCatsErr, count: delCatsCount } = await supabase
      .from('menu_categories')
      .delete()
      .eq('restaurant_id', restaurantId)
      .select('id', { count: 'exact' });
    if (delCatsErr) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[publish] del cats err', delCatsErr);
      }
      return res.status(500).json({ error: delCatsErr.message });
    }
    deletedCats = delCatsCount || 0;

    let categoriesInserted = 0;
    let itemsInserted = 0;
    let linksInserted = 0;

    const catIdMap = new Map<any, any>();

    for (let i = 0; i < categories.length; i++) {
      const c = categories[i];
      const { data: inserted, error } = await supabase
        .from('menu_categories')
        .insert({
          restaurant_id: restaurantId,
          name: c.name,
          description: c.description,
          sort_order: c.sort_order ?? i,
        })
        .select('id')
        .single();
      if (error || !inserted) return res.status(500).json({ error: error?.message || 'Insert category failed' });
      catIdMap.set(c.tempId ?? c.id, inserted.id);
      categoriesInserted++;
    }

    const itemIdMap = new Map<any, any>();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
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
          sort_order: it.sort_order ?? i,
        })
        .select('id')
        .single();
      if (error || !inserted) return res.status(500).json({ error: error?.message || 'Insert item failed' });
      itemIdMap.set(it.tempId ?? it.id, inserted.id);
      itemsInserted++;
      const groupIds = Array.isArray(it.addon_group_ids)
        ? it.addon_group_ids
        : Array.isArray(it.addons)
        ? it.addons
        : [];
      for (const gid of groupIds) {
        const { error: linkErr } = await supabase
          .from('item_addon_links')
          .insert({ item_id: inserted.id, group_id: gid });
        if (linkErr) return res.status(500).json({ error: linkErr.message });
        linksInserted++;
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[publish] result', {
        deletedCats,
        deletedItems,
        deletedLinks,
        insertedCats: categoriesInserted,
        insertedItems,
        insertedLinks,
      });
    }

    return res.status(200).json({
      categoriesInserted,
      itemsInserted,
      linksInserted,
    });
  } catch (error: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[publish] error', error);
    }
    return res.status(500).json({ error: error?.message || 'Unexpected error' });
  }
}
