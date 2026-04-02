import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  return res.status(410).json({
    error:
      'Simulated local completion is disabled. Kiosk success is only allowed after Stripe Terminal reports a completed PaymentIntent.',
  });
}
