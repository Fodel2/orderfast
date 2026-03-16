import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { supaServer } from '@/lib/supaServer';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REFUND_REASON_MAX_LENGTH = 240;
const INTERNAL_NOTE_MAX_LENGTH = 600;

type RefundType = 'full' | 'partial';

const normalizeAmount = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Number(numeric.toFixed(2));
};

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
  const refundType = String(req.body?.refundType || '').trim().toLowerCase() as RefundType;
  const reason = String(req.body?.reason || '').trim().slice(0, REFUND_REASON_MAX_LENGTH);
  const internalNoteRaw = String(req.body?.internalNote || '').trim();
  const internalNote = internalNoteRaw ? internalNoteRaw.slice(0, INTERNAL_NOTE_MAX_LENGTH) : null;
  const providerRaw = String(req.body?.provider || '').trim();
  const provider = providerRaw || 'manual';
  const providerRefundIdRaw = String(req.body?.providerRefundId || '').trim();
  const providerRefundId = providerRefundIdRaw || null;

  if (!UUID_REGEX.test(orderId)) {
    return res.status(400).json({ message: 'Invalid order id' });
  }

  if (refundType !== 'full' && refundType !== 'partial') {
    return res.status(400).json({ message: 'Refund type must be full or partial.' });
  }

  if (!reason) {
    return res.status(400).json({ message: 'Refund reason is required.' });
  }

  const { data: order, error: orderError } = await supaServer
    .from('orders')
    .select('id,restaurant_id,total_price')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (orderError) {
    return res.status(500).json({ message: 'Failed to load order.' });
  }

  if (!order) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  const orderTotal = Number(order.total_price) || 0;
  if (orderTotal <= 0) {
    return res.status(400).json({ message: 'Order total must be greater than 0 for refunds.' });
  }

  const { data: existingRefunds, error: existingRefundsError } = await supaServer
    .from('order_refunds')
    .select('refund_amount')
    .eq('order_id', orderId)
    .eq('restaurant_id', restaurantId);

  if (existingRefundsError) {
    return res.status(500).json({ message: 'Failed to load existing refunds.' });
  }

  const alreadyRefunded = Number(
    ((existingRefunds ?? []) as Array<{ refund_amount?: number | null }>).reduce(
      (sum, entry) => sum + (Number(entry.refund_amount) || 0),
      0
    ).toFixed(2)
  );
  const remainingRefundable = Number(Math.max(orderTotal - alreadyRefunded, 0).toFixed(2));

  if (remainingRefundable <= 0) {
    return res.status(400).json({ message: 'This order has already been fully refunded.' });
  }

  let refundAmount = normalizeAmount(req.body?.refundAmount);

  if (refundType === 'full') {
    refundAmount = remainingRefundable;
  }

  if (!refundAmount || refundAmount <= 0) {
    return res.status(400).json({ message: 'Refund amount must be greater than 0.' });
  }

  if (refundType === 'full' && refundAmount > orderTotal) {
    return res.status(400).json({ message: 'Full refund amount cannot exceed order total.' });
  }

  if (refundType === 'partial' && refundAmount > remainingRefundable) {
    return res.status(400).json({ message: 'Partial refund amount cannot exceed remaining refundable amount.' });
  }

  if (refundAmount + alreadyRefunded > orderTotal) {
    return res.status(400).json({ message: 'Total refunds cannot exceed the order total.' });
  }

  const nowIso = new Date().toISOString();

  const { data: insertedRefund, error: insertError } = await supaServer
    .from('order_refunds')
    .insert({
      order_id: orderId,
      restaurant_id: restaurantId,
      refund_amount: refundAmount,
      refund_type: refundType,
      status: 'succeeded',
      reason,
      internal_note: internalNote,
      provider,
      provider_refund_id: providerRefundId,
      created_by_user_id: session.user.id,
      created_at: nowIso,
      processed_at: nowIso,
    })
    .select(
      'id,order_id,restaurant_id,refund_amount,refund_type,status,reason,internal_note,provider,provider_refund_id,created_by_user_id,created_at,processed_at'
    )
    .single();

  if (insertError) {
    return res.status(500).json({ message: insertError.message || 'Failed to create refund record.' });
  }

  return res.status(200).json({
    ok: true,
    refund: insertedRefund,
    totals: {
      orderTotal,
      alreadyRefunded,
      remainingRefundable: Number(Math.max(orderTotal - (alreadyRefunded + refundAmount), 0).toFixed(2)),
    },
  });
}
