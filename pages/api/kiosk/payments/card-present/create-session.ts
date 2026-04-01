import type { NextApiRequest, NextApiResponse } from 'next';
import { createKioskCardPresentSession } from '@/lib/server/payments/kioskCardPresentService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { restaurant_id, amount_cents, currency, idempotency_key, kiosk_install_id, order_id } = req.body || {};
    if (!restaurant_id || !amount_cents || !currency || !idempotency_key) {
      return res.status(400).json({ error: 'restaurant_id, amount_cents, currency, and idempotency_key are required' });
    }

    const session = await createKioskCardPresentSession({
      restaurantId: String(restaurant_id),
      amountCents: Number(amount_cents),
      currency: String(currency),
      idempotencyKey: String(idempotency_key),
      kioskInstallId: kiosk_install_id ? String(kiosk_install_id) : null,
      orderId: order_id ? String(order_id) : null,
    });

    console.info('[kiosk][session_create_result]', {
      restaurant_id: String(restaurant_id),
      session_id: session.id,
      amount_cents: Number(amount_cents),
      currency: String(currency),
    });
    return res.status(200).json({ session });
  } catch (error: any) {
    const detail = error?.message || 'Failed to create session';
    console.error('[kiosk][session_create_result] failed', {
      restaurant_id: req.body?.restaurant_id ? String(req.body.restaurant_id) : null,
      amount_cents: req.body?.amount_cents ?? null,
      currency: req.body?.currency ? String(req.body.currency) : null,
      error: detail,
    });
    return res.status(400).json({ error: detail });
  }
}
