import type { NextApiRequest, NextApiResponse } from 'next';
import {
  createRestaurantOnboardingLink,
  isStripeConnectConfigError,
  resolveRestaurantIdFromSession,
} from '@/lib/server/payments/stripeConnectService';

type StripeishError = {
  message?: string;
  type?: string;
  code?: string;
  param?: string;
  statusCode?: number;
  requestId?: string;
  rawType?: string;
};

const isStripeError = (error: unknown): error is StripeishError => {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as StripeishError;
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
    if (isStripeConnectConfigError(error)) {
      console.error('[stripe][onboarding-link][config]', {
        restaurantId,
        message: error?.message,
      });
      return res.status(500).json({
        message: 'Stripe onboarding is not configured correctly. Please ask an admin to verify Stripe Connect return URLs.',
      });
    }

    if (isStripeError(error)) {
      console.error('[stripe][onboarding-link][upstream]', {
        restaurantId,
        message: error?.message,
        type: error?.type,
        code: error?.code,
        param: error?.param,
        statusCode: error?.statusCode,
        requestId: error?.requestId,
        rawType: error?.rawType,
      });
      return res.status(502).json({
        message: error?.message || 'Stripe could not create an onboarding link right now. Please try again.',
      });
    }

    console.error('[stripe][onboarding-link][unexpected]', {
      restaurantId,
      message: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: 'Could not start Stripe onboarding. Please retry in a moment.' });
  }
}
