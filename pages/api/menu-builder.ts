import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

const isProd = process.env.NODE_ENV === 'production';

function coerceId(input: unknown): string | undefined {
  if (typeof input === 'string' && input) return input;
  if (typeof input === 'number' && !Number.isNaN(input)) return String(input);
  return undefined;
}

function resolveRestaurantId(req: NextApiRequest): string | undefined {
  const q =
    coerceId(req.query.restaurant_id) ||
    coerceId(req.query.rid) ||
    coerceId((req.body as any)?.restaurantId) ||
    undefined;
  if (q) return q;
  if (!isProd) return process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID;
  return undefined;
}

type DraftPayload = {
  categories: Array<{ id?: string; tempId?: string; name: string; description?: string|null; sort_order?: number; image_url?: string|null }>;
  items: Array<{
    id?: string; tempId?: string; name: string; description?: string|null; price?: number|null;
    image_url?: string|null; is_vegetarian?: boolean; is_vegan?: boolean; is_18_plus?: boolean;
    stock_status?: string|null; available?: boolean; category_id?: string; sort_order?: number
  }>;
  links?: Array<{ item_id: string; group_id: string }>; // IMPORTANT: group_id (schema uses group_id)
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = supaServer;
  const restaurantId = resolveRestaurantId(req);
  const path = req.url || '/api/menu-builder';

  if (!restaurantId) {
    return res.status(400).json({ message: 'restaurant_id is required' });
  }

  try {
    if (req.method === 'GET') {
      const table = 'menu_drafts';
      let data: { draft: DraftPayload; updated_at: string } | null = null;
      const withAddonsParam = req.query.withAddons;
      const withAddons = Array.isArray(withAddonsParam)
        ? withAddonsParam.some((value) =>
            value === '' || value === '1' || value?.toLowerCase?.() === 'true'
          )
        : typeof withAddonsParam === 'string'
        ? withAddonsParam === '' || withAddonsParam === '1' || withAddonsParam.toLowerCase() === 'true'
        : false;
      let addonGroups: any[] | undefined;
      let addonLinks: Array<{ id: string; item_id: string; group_id: string }> | undefined;

      try {
        const response = await supabase
          .from(table)
          .select('draft, updated_at')
          .eq('restaurant_id', restaurantId)
          .maybeSingle()
          .throwOnError();
        data = response.data as typeof data;
      } catch (error: any) {
        console.error('Supabase error:', error?.message, error?.details, error?.hint);
        return res.status(500).json({ error: error?.message, details: error?.details, hint: error?.hint });
      }

      if (withAddons) {
        try {
          const response = await supabase
            .from('addon_groups')
            .select(
              `id,name,multiple_choice,required,max_group_select,max_option_quantity,
              addon_options(id,group_id,name,price,available,out_of_stock_until,stock_status,stock_return_date,stock_last_updated_at)`
            )
            .eq('restaurant_id', restaurantId)
            .throwOnError();
          addonGroups = (response.data as any[])?.map((group) => ({
            id: group.id,
            name: group.name,
            multiple_choice: group.multiple_choice,
            required: group.required,
            max_group_select: group.max_group_select,
            max_option_quantity: group.max_option_quantity,
            addon_options: Array.isArray(group.addon_options)
              ? group.addon_options.map((option: any) => ({
                  id: option.id,
                  group_id: option.group_id,
                  name: option.name,
                  price: option.price,
                  available: option.available,
                  out_of_stock_until: option.out_of_stock_until,
                  stock_status: option.stock_status,
                  stock_return_date: option.stock_return_date,
                  stock_last_updated_at: option.stock_last_updated_at,
                }))
              : [],
          }));
        } catch (error: any) {
          console.error('Supabase error:', error?.message, error?.details, error?.hint);
          return res.status(500).json({ error: error?.message, details: error?.details, hint: error?.hint });
        }

        try {
          const response = await supabase
            .from('item_addon_links')
            .select('id,item_id,group_id,menu_items!inner(id,restaurant_id)')
            .eq('menu_items.restaurant_id', restaurantId)
            .throwOnError();
          addonLinks = ((response.data as any[]) || []).map((link) => ({
            id: String(link.id),
            item_id: String(link.item_id),
            group_id: String(link.group_id),
          }));
        } catch (error: any) {
          console.error('Supabase error:', error?.message, error?.details, error?.hint);
          return res.status(500).json({ error: error?.message, details: error?.details, hint: error?.hint });
        }
      }

      if (!data) {
        let inserted: { draft: DraftPayload; updated_at: string };
        try {
          const response = await supabase
            .from(table)
            .insert({ restaurant_id: restaurantId, draft: {} })
            .select('draft, updated_at')
            .single()
            .throwOnError();
          inserted = response.data as typeof inserted;
        } catch (error: any) {
          console.error('Supabase error:', error?.message, error?.details, error?.hint);
          return res.status(500).json({ error: error?.message, details: error?.details, hint: error?.hint });
        }
        return res.status(200).json({
          draft: inserted.draft,
          payload: inserted.draft,
          updated_at: inserted.updated_at,
          addonGroups: addonGroups ?? [],
          addonLinks: addonLinks ?? [],
        });
      }
      return res.status(200).json({
        draft: data.draft,
        payload: data.draft,
        updated_at: data.updated_at,
        addonGroups: addonGroups ?? [],
        addonLinks: addonLinks ?? [],
      });
    }

    if (req.method === 'PUT') {
      const draft = (req.body as { draft?: DraftPayload }).draft;
      if (!draft) return res.status(400).json({ message: 'draft is required' });

      const table = 'menu_drafts';
      let data: { draft: DraftPayload; updated_at: string };
      try {
        const response = await supabase
          .from(table)
          .upsert({ restaurant_id: restaurantId, draft }, { onConflict: 'restaurant_id' })
          .select('draft, updated_at')
          .single()
          .throwOnError();
        data = response.data as typeof data;
      } catch (error: any) {
        console.error('Supabase error:', error?.message, error?.details, error?.hint);
        return res.status(500).json({ error: error?.message, details: error?.details, hint: error?.hint });
      }
      return res
        .status(200)
        .json({ draft: data.draft, payload: data.draft, updated_at: data.updated_at });
    }

    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).end('Method Not Allowed');
  } catch (e: any) {
    console.error('[draft:unhandled]', {
      path,
      restaurantId,
      error: e,
      message: e?.message,
      code: e?.code,
      details: e?.details,
      hint: e?.hint,
      stack: e?.stack,
    });
    return res.status(500).json({ message: e?.message || 'server_error' });
  }
}

