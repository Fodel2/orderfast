import type { NextApiRequest, NextApiResponse } from 'next';
import { createRestaurantOnboardingLink, resolveRestaurantIdFromSession } from '@/lib/server/payments/stripeConnectService';

const isStripeError = (error: unknown): error is { message?: string } => {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { type?: string; rawType?: string };
  const hasStripeType = typeof maybe.type === 'string' && maybe.type.startsWith('Stripe');
  const hasRawStripeType = typeof maybe.rawType === 'string';
  return hasStripeType || hasRawStripeType;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const restaurantId = await resolveRestaurantIdFromSession(req, res);
  if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const payload = await createRestaurantOnboardingLink(restaurantId);
    return res.status(200).json(payload);
  } catch (error: any) {
    if (isStripeError(error)) {
      return res.status(502).json({
        message: error?.message || 'Stripe could not create an onboarding link right now. Please try again.',
      });
    }

    return res.status(500).json({ message: 'Could not start Stripe onboarding. Please retry in a moment.' });
  }
}
