import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';
import { evaluateAvailability, type OpeningException, type OpeningPeriod } from '@/lib/customerAvailability';

type CreateOrderAddonInput = {
  option_id: number;
  name: string;
  price: number;
  quantity: number;
};

type CreateOrderItemInput = {
  item_id: number;
  name: string;
  price: number;
  quantity: number;
  notes?: string | null;
  addons?: CreateOrderAddonInput[];
};

type CreateOrderInput = {
  channel: 'website' | 'kiosk' | 'express';
  restaurantId: string;
  order: {
    user_id?: string | null;
    customer_name?: string | null;
    order_type: string;
    source: string;
    delivery_address?: Record<string, unknown> | null;
    phone_number?: string | null;
    customer_notes?: string | null;
    scheduled_for?: string | null;
    status: string;
    accepted_at?: string | null;
    total_price: number;
    service_fee?: number;
    delivery_fee?: number;
    dine_in_table_number?: number | null;
    table_session_id?: string | null;
  };
  items: CreateOrderItemInput[];
};

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadEffectiveAvailability(restaurantId: string) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 1);
  const end = new Date(today);
  end.setDate(today.getDate() + 7);

  const [restaurantRes, weeklyRes, exceptionRes] = await Promise.all([
    supaServer.from('restaurants').select('is_open, break_until, updated_at').eq('id', restaurantId).maybeSingle(),
    supaServer
      .from('opening_hours_weekly_periods')
      .select('day_of_week,open_time,close_time,sort_order')
      .eq('restaurant_id', restaurantId),
    supaServer
      .from('opening_hours_exceptions')
      .select('exception_date,is_closed,opening_hours_exception_periods(open_time,close_time,sort_order)')
      .eq('restaurant_id', restaurantId)
      .gte('exception_date', toIso(start))
      .lte('exception_date', toIso(end)),
  ]);

  const isOpen = typeof restaurantRes.data?.is_open === 'boolean' ? restaurantRes.data.is_open : true;
  const breakUntil = restaurantRes.data?.break_until || null;
  const availabilityUpdatedAt = restaurantRes.data?.updated_at || null;
  const weeklyPeriods = (weeklyRes.data || []) as Array<OpeningPeriod & { day_of_week: number }>;
  const exceptions: OpeningException[] = ((exceptionRes.data || []) as any[]).map((row) => ({
    exception_date: row.exception_date,
    is_closed: Boolean(row.is_closed),
    periods: (row.opening_hours_exception_periods || []) as OpeningPeriod[],
  }));

  return evaluateAvailability({
    now: new Date(),
    isOpen,
    breakUntil,
    availabilityUpdatedAt,
    weeklyPeriods,
    exceptions,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = req.body as CreateOrderInput;
  const restaurantId = String(payload?.restaurantId || '').trim();
  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (!restaurantId || !payload?.order || items.length === 0) {
    return res.status(400).json({ error: 'Missing required order payload' });
  }

  const snapshot = await loadEffectiveAvailability(restaurantId);
  if (snapshot.blocksNewSessions) {
    return res.status(409).json({ error: 'Ordering unavailable', availability: snapshot });
  }

  const orderInsert = {
    restaurant_id: restaurantId,
    user_id: payload.order.user_id || null,
    customer_name: payload.order.customer_name || null,
    order_type: payload.order.order_type,
    source: payload.order.source,
    delivery_address: payload.order.delivery_address || null,
    phone_number: payload.order.phone_number || null,
    customer_notes: payload.order.customer_notes || null,
    scheduled_for: payload.order.scheduled_for || null,
    status: payload.order.status,
    accepted_at: payload.order.accepted_at || null,
    total_price: payload.order.total_price,
    service_fee: payload.order.service_fee || 0,
    delivery_fee: payload.order.delivery_fee || 0,
    dine_in_table_number: payload.order.dine_in_table_number || null,
    table_session_id: payload.order.table_session_id || null,
  };

  const { data: order, error: orderError } = await supaServer
    .from('orders')
    .insert([orderInsert])
    .select('id, short_order_number')
    .single();

  if (orderError || !order) {
    return res.status(500).json({ error: orderError?.message || 'Failed to create order' });
  }

  try {
    for (const item of items) {
      const { data: orderItem, error: itemError } = await supaServer
        .from('order_items')
        .insert([
          {
            order_id: order.id,
            item_id: item.item_id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            notes: item.notes || null,
          },
        ])
        .select('id')
        .single();

      if (itemError || !orderItem) throw itemError || new Error('Failed to insert order item');

      for (const addon of item.addons || []) {
        const { error: addonError } = await supaServer.from('order_addons').insert([
          {
            order_item_id: orderItem.id,
            option_id: addon.option_id,
            name: addon.name,
            price: addon.price,
            quantity: addon.quantity,
          },
        ]);
        if (addonError) throw addonError;
      }
    }
  } catch (err: any) {
    await supaServer.from('orders').delete().eq('id', order.id);
    return res.status(500).json({ error: err?.message || 'Failed to create order items' });
  }

  return res.status(200).json({
    order: {
      id: order.id,
      short_order_number: order.short_order_number ?? 0,
    },
  });
}
