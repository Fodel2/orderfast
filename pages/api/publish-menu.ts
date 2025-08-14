import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const supabase = createServerSupabaseClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const { restaurantId } = req.body as { restaurantId?: string };
  if (!restaurantId) {
    return res.status(400).json({ error: 'Missing restaurantId' });
  }

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

  const { data: liveItems, error: liveErr } = await supabase
    .from('menu_items')
    .select('id')
    .eq('restaurant_id', restaurantId);
  if (liveErr) return res.status(500).json({ error: liveErr.message });
  const liveItemIds = (liveItems || []).map((r: any) => r.id);

  if (liveItemIds.length) {
    const { error: delLinksErr } = await supabase
      .from('item_addon_links')
      .delete()
      .in('item_id', liveItemIds);
    if (delLinksErr) return res.status(500).json({ error: delLinksErr.message });
  }

  const { error: delItemsErr } = await supabase
    .from('menu_items')
    .delete()
    .eq('restaurant_id', restaurantId);
  if (delItemsErr) return res.status(500).json({ error: delItemsErr.message });

  const { error: delCatsErr } = await supabase
    .from('menu_categories')
    .delete()
    .eq('restaurant_id', restaurantId);
  if (delCatsErr) return res.status(500).json({ error: delCatsErr.message });

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

  if (process.env.NODE_ENV === 'development') {
    console.debug('[publish] replaced', {
      cats: categoriesInserted,
      items: itemsInserted,
      links: linksInserted,
    });
  }

  return res.status(200).json({
    categoriesInserted,
    itemsInserted,
    linksInserted,
  });
}
