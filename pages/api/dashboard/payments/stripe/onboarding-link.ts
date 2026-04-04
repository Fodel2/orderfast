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
  const logContext = {
    route: '/api/dashboard/payments/stripe/onboarding-link',
    method: req.method,
  };
  console.info('[stripe][onboarding-link][route.start]', logContext);
  let restaurantId: string | null = null;
  let step = 'pre.lookup.method_check';
  try {
    console.info('[stripe][onboarding-link][pre.lookup.method_check.before]', logContext);
    const requestMethod = typeof req?.method === 'string' ? req.method : '';
    const isPost = requestMethod === 'POST';
    console.info('[stripe][onboarding-link][pre.lookup.method_check.after]', {
      ...logContext,
      requestMethod,
      isPost,
    });
    if (!isPost) {
      console.warn('[stripe][onboarding-link][pre.lookup.method_not_allowed.before_set_header]', {
        ...logContext,
        requestMethod,
      });
      res.setHeader('Allow', 'POST');
      console.warn('[stripe][onboarding-link][pre.lookup.method_not_allowed.after_set_header]', {
        ...logContext,
        requestMethod,
      });
      return res.status(405).json({ message: 'Method not allowed' });
    }

    step = 'pre.lookup.restaurant_id_init';
    console.info('[stripe][onboarding-link][pre.lookup.restaurant_id_init.before]', logContext);
    restaurantId = null;
    console.info('[stripe][onboarding-link][pre.lookup.restaurant_id_init.after]', logContext);

    step = 'restaurant.lookup';
    console.info('[stripe][onboarding-link][pre.lookup.try_enter]', logContext);
    console.info('[stripe][onboarding-link][restaurant.lookup.start]', logContext);
    restaurantId = await resolveRestaurantIdFromSession(req, res);
    console.info('[stripe][onboarding-link][restaurant.lookup.result]', {
      ...logContext,
      restaurantId,
    });
    if (!restaurantId) {
      console.warn('[stripe][onboarding-link][route.unauthorized]', logContext);
      return res.status(401).json({ message: 'Unauthorized' });
    }

    step = 'service.create_link';
    console.info('[stripe][onboarding-link][service.create_link.start]', {
      ...logContext,
      restaurantId,
    });
    const payload = await createRestaurantOnboardingLink(restaurantId);
    console.info('[stripe][onboarding-link][route.success]', {
      ...logContext,
      restaurantId,
      accountId: payload.accountId,
      expiresAt: payload.expiresAt,
    });
    return res.status(200).json(payload);
  } catch (error: any) {
    if (isStripeConnectConfigError(error)) {
      console.error('[stripe][onboarding-link][config]', {
        ...logContext,
        restaurantId,
        message: error?.message,
        stack: error?.stack,
      });
      return res.status(500).json({
        message: 'Stripe onboarding is not configured correctly. Please ask an admin to verify Stripe Connect return URLs.',
      });
    }

    if (isStripeError(error)) {
      console.error('[stripe][onboarding-link][upstream]', {
        ...logContext,
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
      ...logContext,
      restaurantId,
      step,
      message: error?.message,
      stack: error?.stack,
    });
    if (step === 'restaurant.lookup') {
      return res.status(500).json({ message: 'Could not resolve your restaurant session. Please sign in again and retry.' });
    }
    return res.status(500).json({ message: 'Could not start Stripe onboarding. Please retry in a moment.' });
  }
}
