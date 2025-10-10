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
      const table = 'menu_builder_drafts';
      const line = 'pages/api/menu-builder.ts:60';
      const { data, error } = await supabase
        .from(table)
        .select('payload, updated_at')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (error) {
        console.error('[draft:load]', { path, restaurantId, table, line, error });
        return res
          .status(500)
          .json({ message: error.message, table, line });
      }

      if (!data) {
        const initLine = 'pages/api/menu-builder.ts:72';
        const { data: inserted, error: insertErr } = await supabase
          .from(table)
          .insert({ restaurant_id: restaurantId, payload: {} })
          .select('payload, updated_at')
          .single();
        if (insertErr) {
          console.error('[draft:init]', { path, restaurantId, table, line: initLine, error: insertErr });
          return res.status(500).json({ message: insertErr.message, table, line: initLine });
        }
        return res.status(200).json({ draft: inserted.payload, payload: inserted.payload, updated_at: inserted.updated_at });
      }
      return res
        .status(200)
        .json({ draft: data.payload, payload: data.payload, updated_at: data.updated_at });
    }

    if (req.method === 'PUT') {
      const draft = (req.body as { draft?: DraftPayload }).draft;
      if (!draft) return res.status(400).json({ message: 'draft is required' });

      const table = 'menu_builder_drafts';
      const line = 'pages/api/menu-builder.ts:94';
      const { data, error } = await supabase
        .from(table)
        .upsert({ restaurant_id: restaurantId, payload: draft }, { onConflict: 'restaurant_id' })
        .select('payload, updated_at')
        .single();

      if (error) {
        console.error('[draft:save]', { path, restaurantId, table, line, error });
        return res.status(500).json({ message: error.message, table, line });
      }
      return res
        .status(200)
        .json({ draft: data.payload, payload: data.payload, updated_at: data.updated_at });
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

