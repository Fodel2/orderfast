import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).end('Method Not Allowed');
  }

  const { restaurantId, categories, items } = req.body || {};
  if (!restaurantId) {
    return res.status(400).json({ message: 'restaurantId is required' });
  }

  const supabase = supaServer;

  try {
    if (Array.isArray(categories) && categories.length) {
      const catUpdates = categories.map((c: any) =>
        supabase
          .from('menu_categories')
          .update({ sort_order: c.sort_order })
          .eq('id', c.id)
          .eq('restaurant_id', restaurantId)
      );
      await Promise.all(catUpdates);
    }

    if (Array.isArray(items) && items.length) {
      const itemUpdates = items.map((it: any) => {
        const fields: any = { sort_order: it.sort_order };
        if (it.category_id !== undefined) fields.category_id = it.category_id;
        return supabase
          .from('menu_items')
          .update(fields)
          .eq('id', it.id)
          .eq('restaurant_id', restaurantId);
      });
      await Promise.all(itemUpdates);
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('menu-reorder', error);
    return res.status(500).json({ message: error?.message || 'server_error' });
  }
}

