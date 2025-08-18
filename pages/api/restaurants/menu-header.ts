import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

const isProd = process.env.NODE_ENV === 'production';

function resolveRestaurantId(req: NextApiRequest): string | undefined {
  const q =
    (typeof req.query.restaurant_id === 'string' && req.query.restaurant_id) ||
    (typeof req.query.rid === 'string' && req.query.rid) ||
    (typeof (req.body as any)?.restaurantId === 'string' && (req.body as any).restaurantId) ||
    undefined;
  if (q) return q;
  if (!isProd) return process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID;
  return undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).end('Method Not Allowed');
  }

  const restaurantId = resolveRestaurantId(req);
  if (!restaurantId) return res.status(400).json({ message: 'restaurant_id is required' });

  const supabase = supaServer();
  const { imageUrl, focalX, focalY } = req.body || {};

  const update = imageUrl
    ? {
        menu_header_image_url: imageUrl,
        menu_header_focal_x: focalX,
        menu_header_focal_y: focalY,
        menu_header_image_updated_at: new Date().toISOString(),
      }
    : {
        menu_header_image_url: null,
        menu_header_focal_x: null,
        menu_header_focal_y: null,
        menu_header_image_updated_at: new Date().toISOString(),
      };

  const { data, error } = await supabase
    .from('restaurants')
    .update(update)
    .eq('id', restaurantId)
    .select(
      'menu_header_image_url,menu_header_focal_x,menu_header_focal_y,menu_header_image_updated_at'
    )
    .single();

  if (error) {
    console.error('[menu-header:update]', { restaurantId, error });
    return res.status(500).json({ message: error.message });
  }

  return res.status(200).json(data);
}

