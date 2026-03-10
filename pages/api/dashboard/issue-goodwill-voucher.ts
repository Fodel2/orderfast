import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { supaServer } from '@/lib/supaServer';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MESSAGE_MAX_LENGTH = 240;

const toDateAtEndOfDayUtc = (input: string) => {
  const trimmed = String(input || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return new Date(`${trimmed}T23:59:59.999Z`);
};

const generateVoucherCode = () => {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 8; i += 1) {
    token += charset[Math.floor(Math.random() * charset.length)];
  }
  return `GW-${token}`;
};

async function createVoucherCodeRow(promotionId: string, endsAtIso: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateVoucherCode();
    const insertResult = await supaServer
      .from('promotion_voucher_codes')
      .insert({
        promotion_id: promotionId,
        code,
        starts_at: new Date().toISOString(),
        ends_at: endsAtIso,
        max_uses_total: 1,
        max_uses_per_customer: 1,
      })
      .select('id,code')
      .single();

    if (!insertResult.error && insertResult.data?.id && insertResult.data?.code) {
      return {
        id: String(insertResult.data.id),
        code: String(insertResult.data.code),
      };
    }

    if (insertResult.error?.code !== '23505') {
      throw insertResult.error;
    }
  }

  throw new Error('Unable to generate a unique voucher code. Please try again.');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const supabaseAuth = createServerSupabaseClient({ req, res });
  const {
    data: { session },
  } = await supabaseAuth.auth.getSession();

  if (!session?.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { data: membership, error: membershipError } = await supaServer
    .from('restaurant_users')
    .select('restaurant_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (membershipError || !membership?.restaurant_id) {
    return res.status(403).json({ message: 'Restaurant context unavailable' });
  }

  const restaurantId = String(membership.restaurant_id);
  const orderId = String(req.body?.orderId || '').trim();
  const expiryDate = String(req.body?.expiryDate || '').trim();
  const messageRaw = String(req.body?.message || '');
  const amountValue = Number(req.body?.amount);

  if (!UUID_REGEX.test(orderId)) {
    return res.status(400).json({ message: 'Invalid order id' });
  }

  if (!Number.isFinite(amountValue) || amountValue <= 0 || amountValue > 500) {
    return res.status(400).json({ message: 'Voucher value must be greater than 0 and no more than £500.' });
  }

  const expiryAt = toDateAtEndOfDayUtc(expiryDate);
  if (!expiryAt || Number.isNaN(expiryAt.valueOf())) {
    return res.status(400).json({ message: 'Expiry date is required.' });
  }

  if (expiryAt.valueOf() <= Date.now()) {
    return res.status(400).json({ message: 'Expiry date must be in the future.' });
  }

  const message = messageRaw.trim().slice(0, MESSAGE_MAX_LENGTH);

  const { data: order, error: orderError } = await supaServer
    .from('orders')
    .select('id,restaurant_id,user_id,status,order_type,short_order_number,customer_name')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (orderError) {
    return res.status(500).json({ message: 'Failed to load order.' });
  }

  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  const customerId = String(order.user_id || '').trim();
  if (!customerId || !UUID_REGEX.test(customerId)) {
    return res.status(400).json({ message: 'Customer account required.' });
  }

  if (!['completed', 'cancelled'].includes(String(order.status || ''))) {
    return res.status(400).json({ message: 'Goodwill vouchers can only be issued from completed/cancelled orders.' });
  }

  const orderType = String(order.order_type || '').toLowerCase();
  if (orderType === 'kiosk' || orderType === 'express') {
    return res.status(400).json({ message: 'Goodwill vouchers are not available for this order type.' });
  }

  const amount = Number(amountValue.toFixed(2));

  try {
    const { data: promotion, error: promotionError } = await supaServer
      .from('promotions')
      .insert({
        restaurant_id: restaurantId,
        name: `Goodwill Voucher ${order.short_order_number ? `#${order.short_order_number}` : ''}`.trim(),
        description: message || 'Issued by restaurant support.',
        type: 'voucher',
        status: 'active',
        priority: 100,
        channels: ['website'],
        order_types: ['delivery', 'collection', 'dine_in'],
        promo_terms: message || null,
        starts_at: new Date().toISOString(),
        ends_at: expiryAt.toISOString(),
        max_uses_total: 1,
        max_uses_per_customer: 1,
      })
      .select('id')
      .single();

    if (promotionError || !promotion?.id) {
      throw promotionError || new Error('Failed to create promotion');
    }

    const { error: rewardError } = await supaServer.from('promotion_rewards').upsert(
      {
        promotion_id: promotion.id,
        reward: {
          discount_type: 'fixed',
          discount_value: amount,
        },
      },
      { onConflict: 'promotion_id' }
    );

    if (rewardError) throw rewardError;

    const voucherCode = await createVoucherCodeRow(String(promotion.id), expiryAt.toISOString());

    const { error: ledgerError } = await supaServer.from('loyalty_ledger').insert({
      restaurant_id: restaurantId,
      customer_id: customerId,
      entry_type: 'spend',
      points: 0,
      currency_value: amount,
      note: `Redeemed for voucher ${voucherCode.code}`,
    });

    if (ledgerError) throw ledgerError;

    return res.status(200).json({
      ok: true,
      voucherCode: voucherCode.code,
      voucherCodeId: voucherCode.id,
      promotionId: promotion.id,
      customerId,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Failed to issue goodwill voucher.' });
  }
}
