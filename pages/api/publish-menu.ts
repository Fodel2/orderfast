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

    let archivedCats = 0;
    let archivedItems = 0;

    const { data: archItems, error: archItemsErr } = await supabase
      .from('menu_items')
      .update({ archived_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null)
      .select('id');
    if (archItemsErr) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[publish] archive items err', archItemsErr);
      }
      return res.status(500).json({ error: archItemsErr.message });
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
        if (process.env.NODE_ENV === 'development') {
          console.error('[publish] del links err', delLinksErr);
        }
        return res.status(500).json({ error: delLinksErr.message });
      }
    }

    const { data: archCats, error: archCatsErr } = await supabase
      .from('menu_categories')
      .update({ archived_at: new Date().toISOString() })
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null)
      .select('id');
    if (archCatsErr) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[publish] archive cats err', archCatsErr);
      }
      return res.status(500).json({ error: archCatsErr.message });
    }
    archivedCats = archCats?.length ?? 0;

    let insertedCats = 0;
    let insertedItems = 0;
    let insertedLinks = 0;

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
      if (error || !inserted)
        return res
          .status(500)
          .json({ error: error?.message || 'Insert category failed' });
      catIdMap.set(c.tempId ?? c.id, inserted.id);
      insertedCats++;
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
      if (error || !inserted)
        return res
          .status(500)
          .json({ error: error?.message || 'Insert item failed' });
      itemIdMap.set(it.tempId ?? it.id, inserted.id);
      insertedItems++;
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
        insertedLinks++;
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[publish]', {
        rid: restaurantId,
        archivedCats,
        archivedItems,
        insertedCats,
        insertedItems,
        insertedLinks,
      });
    }

    return res.status(200).json({
      archivedCats,
      archivedItems,
      insertedCats,
      insertedItems,
      insertedLinks,
    });
  } catch (error: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[publish] error', error);
    }
    return res.status(500).json({ error: error?.message || 'Unexpected error' });
  }
}
