import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const restaurantId =
    req.method === 'GET'
      ? (req.query.restaurant_id as string | undefined)
      : (req.body?.restaurantId as string | undefined);

  if (!restaurantId) {
    return res.status(400).json({ error: 'missing_restaurant_id' });
  }

  const supabase = supaServer;
  let step = '';

  try {
    if (req.method === 'GET') {
      step = 'load-draft';
      const { data, error } = await supabase
        .from('menu_builder_drafts')
        .select('data')
        .eq('restaurant_id', restaurantId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw { step, error };
      const draft = data?.data || null;
      if (req.query.withAddons === '1') {
        step = 'load-addon-groups';
        const { data: groups, error: grpErr } = await supabase
          .from('addon_groups')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('id');
        if (grpErr) throw { step, error: grpErr };
        step = 'load-addon-links';
        const { data: linksData, error: linkErr } = await supabase
          .from('item_addon_links')
          .select('item_id,group_id,menu_items!inner(restaurant_id)')
          .eq('menu_items.restaurant_id', restaurantId);
        if (linkErr) throw { step, error: linkErr };
        const addonLinks = (linksData || []).map((r: any) => ({
          item_id: r.item_id,
          group_id: r.group_id,
        }));
        return res
          .status(200)
          .json({ draft, addonGroups: groups || [], addonLinks });
      }
      return res.status(200).json({ draft });
    }

    if (req.method === 'PUT') {
      step = 'save-draft';
      const data = req.body?.data;
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'missing_data' });
      }
      const { error } = await supabase
        .from('menu_builder_drafts')
        .upsert(
          {
            restaurant_id: restaurantId,
            data,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'restaurant_id' }
        );
      if (error) throw { step, error };
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST') {
      let archivedItems = 0;
      let archivedCats = 0;
      let insertedCats = 0;
      let insertedItems = 0;
      let insertedLinks = 0;

      step = 'load-draft';
      const { data: draftRow, error: draftErr } = await supabase
        .from('menu_builder_drafts')
        .select('data')
        .eq('restaurant_id', restaurantId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (draftErr) throw { step, error: draftErr };
      if (!draftRow || !draftRow.data) {
        return res.status(400).json({ error: 'no_draft' });
      }
      const draft = draftRow.data as any;

      step = 'load-live';
      const { data: existingItems, error: itemsErr } = await supabase
        .from('menu_items')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .is('archived_at', null);
      if (itemsErr) throw { step, error: itemsErr };
      const { data: existingCats, error: catsErr } = await supabase
        .from('menu_categories')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .is('archived_at', null);
      if (catsErr) throw { step, error: catsErr };

      const now = new Date().toISOString();

      if (existingItems?.length) {
        step = 'archive-live';
        const { error: archItemsErr } = await supabase
          .from('menu_items')
          .update({ archived_at: now })
          .in('id', existingItems.map((r: any) => r.id));
        if (archItemsErr) throw { step, error: archItemsErr };
        archivedItems = existingItems.length;

        const { error: delLinksErr } = await supabase
          .from('item_addon_links')
          .delete()
          .in('item_id', existingItems.map((r: any) => r.id));
        if (delLinksErr) throw { step: 'insert-links', error: delLinksErr };
      }

      if (existingCats?.length) {
        step = 'archive-live';
        const { error: archCatsErr } = await supabase
          .from('menu_categories')
          .update({ archived_at: now })
          .in('id', existingCats.map((r: any) => r.id));
        if (archCatsErr) throw { step, error: archCatsErr };
        archivedCats = existingCats.length;
      }

      const catIdMap = new Map<string, number>();
      if (Array.isArray(draft.categories)) {
        step = 'insert-cats';
        for (const c of draft.categories) {
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
          if (error || !inserted) throw { step, error };
          catIdMap.set(String(c.id ?? c.tempId), inserted.id);
          insertedCats++;
        }
      }

      if (Array.isArray(draft.items)) {
        step = 'insert-items';
        for (const it of draft.items) {
          const catId = it.category_id
            ? catIdMap.get(String(it.category_id)) || null
            : null;
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
          if (error || !inserted) throw { step, error };
          insertedItems++;

          if (Array.isArray(it.addons)) {
            for (const gid of it.addons) {
              step = 'insert-links';
              const { error: linkErr } = await supabase
                .from('item_addon_links')
                .insert({ item_id: inserted.id, group_id: gid });
              if (linkErr) throw { step, error: linkErr };
              insertedLinks++;
            }
          }
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[publish-menu]', {
          archivedCats,
          archivedItems,
          insertedCats,
          insertedItems,
          insertedLinks,
        });
      }

      return res.status(200).json({
        ok: true,
        counts: {
          archivedCats,
          archivedItems,
          insertedCats,
          insertedItems,
          insertedLinks,
        },
      });
    }

    res.setHeader('Allow', 'GET,PUT,POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err: any) {
    const stepName = err.step || step;
    const supErr = err.error || err;
    console.error(err);
    if (process.env.NODE_ENV !== 'production') {
      console.error('[api/menu-builder]', stepName, supErr);
      if (req.method === 'POST') {
        console.error('[publish-menu]', stepName, supErr);
      }
      return res
        .status(500)
        .json({ error: supErr?.message || 'server_error', hint: stepName });
    }
    return res.status(500).json({ error: 'server_error' });
  }
}

