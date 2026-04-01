import Stripe from 'stripe';
import { KIOSK_CARD_PRESENT_SESSION_STATES, type KioskCardPresentSession, type KioskCardPresentSessionState } from '@/lib/payments/kioskCardPresent';
import { supaServer } from '@/lib/supaServer';
import { getStripeClient } from './stripeClient';
import { getRestaurantStripeContext, isTapToPayAvailableForRestaurant } from './restaurantStripeContext';

type SessionRow = Omit<KioskCardPresentSession, 'metadata'> & { metadata: unknown };

const SESSION_SELECT =
  'id,restaurant_id,order_id,amount_cents,currency,state,stripe_connected_account_id,stripe_terminal_location_id,stripe_payment_intent_id,idempotency_key,kiosk_install_id,failure_code,failure_message,metadata,created_at,updated_at,finalized_at';

const TERMINAL_SESSION_STATES: ReadonlySet<KioskCardPresentSessionState> = new Set(['finalized', 'canceled', 'failed']);

const toSession = (row: SessionRow): KioskCardPresentSession => ({
  ...row,
  metadata: row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : null,
});

const assertState = (state: string): KioskCardPresentSessionState => {
  if ((KIOSK_CARD_PRESENT_SESSION_STATES as readonly string[]).includes(state)) {
    return state as KioskCardPresentSessionState;
  }
  throw new Error(`Invalid kiosk payment session state: ${state}`);
};

const serializeStripeError = (error: unknown) => {
  if (!error || typeof error !== 'object') return { message: String(error || 'Unknown Stripe error') };
  const stripeError = error as Record<string, unknown>;
  return {
    message: typeof stripeError.message === 'string' ? stripeError.message : 'Unknown Stripe error',
    type: stripeError.type ?? null,
    code: stripeError.code ?? null,
    decline_code: stripeError.decline_code ?? null,
    payment_intent: stripeError.payment_intent ?? null,
    raw: stripeError.raw ?? null,
  };
};

export const createKioskCardPresentSession = async (input: {
  restaurantId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  kioskInstallId?: string | null;
  orderId?: string | null;
  metadata?: Record<string, unknown> | null;
}) => {
  if (!(await isTapToPayAvailableForRestaurant(input.restaurantId))) {
    throw new Error('Tap to Pay is not available for this restaurant yet');
  }

  const context = await getRestaurantStripeContext(input.restaurantId);
  if (!context?.connectedAccountId || !context.terminalLocationId || !context.tapToPayAvailable) {
    throw new Error('Stripe Terminal context is not ready');
  }

  const { data: existing, error: existingError } = await supaServer
    .from('kiosk_card_present_sessions')
    .select(SESSION_SELECT)
    .eq('restaurant_id', input.restaurantId)
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return toSession(existing as SessionRow);

  const payload = {
    restaurant_id: input.restaurantId,
    order_id: input.orderId ?? null,
    amount_cents: Math.max(1, Math.floor(input.amountCents)),
    currency: input.currency.toLowerCase(),
    state: 'readiness_verified',
    stripe_connected_account_id: context.connectedAccountId,
    stripe_terminal_location_id: context.terminalLocationId,
    idempotency_key: input.idempotencyKey,
    kiosk_install_id: input.kioskInstallId ?? null,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supaServer.from('kiosk_card_present_sessions').insert(payload).select(SESSION_SELECT).single();
  if (error || !data) throw error || new Error('Failed to create kiosk card present session');

  await appendKioskPaymentSessionEvent((data as SessionRow).id, 'readiness_verified', 'session_created', {
    amount_cents: payload.amount_cents,
    currency: payload.currency,
  });

  return toSession(data as SessionRow);
};

export const getKioskPaymentSession = async (sessionId: string, restaurantId?: string | null) => {
  let query = supaServer.from('kiosk_card_present_sessions').select(SESSION_SELECT).eq('id', sessionId);
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? toSession(data as SessionRow) : null;
};

export const markKioskPaymentSessionState = async (input: {
  sessionId: string;
  restaurantId?: string | null;
  nextState: KioskCardPresentSessionState;
  failureCode?: string | null;
  failureMessage?: string | null;
  eventType?: string;
  eventPayload?: Record<string, unknown>;
}) => {
  const session = await getKioskPaymentSession(input.sessionId, input.restaurantId);
  if (!session) throw new Error('Kiosk payment session not found');

  const attemptedNextState = input.nextState;
  const nextState =
    session.state === 'finalized' && attemptedNextState !== 'finalized'
      ? 'finalized'
      : session.state === attemptedNextState
        ? session.state
        : attemptedNextState;

  const shouldPreserveFailureMessage = nextState === 'finalized' && attemptedNextState !== 'finalized';

  const { data, error } = await supaServer
    .from('kiosk_card_present_sessions')
    .update({
      state: nextState,
      failure_code: input.failureCode ?? session.failure_code,
      failure_message: shouldPreserveFailureMessage ? session.failure_message : input.failureMessage ?? session.failure_message,
      finalized_at: nextState === 'finalized' ? session.finalized_at ?? new Date().toISOString() : session.finalized_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id)
    .select(SESSION_SELECT)
    .single();

  if (error || !data) throw error || new Error('Failed to update kiosk payment session state');

  await appendKioskPaymentSessionEvent(
    session.id,
    nextState,
    input.eventType ?? 'state_transition',
    input.eventPayload ?? { from: session.state, to: nextState, attempted_to: attemptedNextState }
  );

  return toSession(data as SessionRow);
};

export const appendKioskPaymentSessionEvent = async (
  sessionId: string,
  state: KioskCardPresentSessionState,
  eventType: string,
  payload: Record<string, unknown> | null = null
) => {
  const { error } = await supaServer.from('kiosk_card_present_events').insert({
    session_id: sessionId,
    state,
    event_type: eventType,
    payload: payload ?? {},
  });

  if (error) throw error;
};

export const createTerminalConnectionTokenForSession = async (input: { sessionId: string; restaurantId?: string | null }) => {
  const session = await getKioskPaymentSession(input.sessionId, input.restaurantId);
  if (!session) throw new Error('Kiosk payment session not found');

  const stripe = getStripeClient();
  const token = await stripe.terminal.connectionTokens.create({}, { stripeAccount: session.stripe_connected_account_id });

  await appendKioskPaymentSessionEvent(session.id, session.state, 'connection_token_created', {
    token_created_at: new Date().toISOString(),
  });

  return { session, secret: token.secret };
};

export const createOrRetrieveCardPresentPaymentIntentForSession = async (input: { sessionId: string; restaurantId?: string | null }) => {
  const session = await getKioskPaymentSession(input.sessionId, input.restaurantId);
  if (!session) throw new Error('Kiosk payment session not found');

  if (session.state === 'finalized') {
    const stripe = getStripeClient();
    if (!session.stripe_payment_intent_id) throw new Error('Finalized session missing Stripe payment intent');
    const finalizedIntent = await stripe.paymentIntents.retrieve(session.stripe_payment_intent_id, {
      stripeAccount: session.stripe_connected_account_id,
    });
    return {
      paymentIntentId: finalizedIntent.id,
      clientSecret: finalizedIntent.client_secret,
      status: finalizedIntent.status,
    };
  }

  const stripe = getStripeClient();
  const stripeAccount = session.stripe_connected_account_id;
  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: session.amount_cents,
    currency: session.currency,
    payment_method_types: ['card_present'],
    capture_method: 'automatic',
    metadata: {
      restaurant_id: session.restaurant_id,
      kiosk_payment_session_id: session.id,
    },
  };

  let paymentIntent: Stripe.PaymentIntent;
  try {
    if (session.stripe_payment_intent_id) {
      paymentIntent = await stripe.paymentIntents.retrieve(session.stripe_payment_intent_id, { stripeAccount });
    } else {
      paymentIntent = await stripe.paymentIntents.create(paymentIntentParams, {
        stripeAccount,
        idempotencyKey: `kiosk_pi_${session.id}`,
      });

      const { error } = await supaServer
        .from('kiosk_card_present_sessions')
        .update({
          stripe_payment_intent_id: paymentIntent.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      if (error) throw error;
    }
  } catch (error) {
    const context = {
      session_id: session.id,
      restaurant_id: session.restaurant_id,
      connected_account_id: stripeAccount,
      terminal_location_id: session.stripe_terminal_location_id,
      amount: session.amount_cents,
      currency: session.currency,
      payment_intent_params_shape: {
        ...paymentIntentParams,
        metadata: Object.keys(paymentIntentParams.metadata || {}),
      },
      stripe_error: serializeStripeError(error),
    };
    console.error('[kiosk][payment_intent_result] failed', context);
    throw new Error(`payment_intent_result failed: ${JSON.stringify(context)}`);
  }

  await markKioskPaymentSessionState({
    sessionId: session.id,
    restaurantId: session.restaurant_id,
    nextState: 'ready_to_collect',
    eventType: 'payment_intent_ready',
    eventPayload: {
      payment_intent_id: paymentIntent.id,
      payment_intent_status: paymentIntent.status,
    },
  });

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    status: paymentIntent.status,
  };
};

export const cancelKioskPaymentSession = async (input: { sessionId: string; restaurantId?: string | null; reason?: string }) => {
  const session = await getKioskPaymentSession(input.sessionId, input.restaurantId);
  if (!session) throw new Error('Kiosk payment session not found');

  if (session.state === 'finalized') {
    return session;
  }

  if (session.state === 'canceled') {
    return markKioskPaymentSessionState({
      sessionId: session.id,
      nextState: 'canceled',
      restaurantId: session.restaurant_id,
      failureMessage: session.failure_message ?? input.reason ?? 'Canceled by user',
      eventType: 'session_canceled_idempotent',
    });
  }

  if (session.stripe_payment_intent_id) {
    const stripe = getStripeClient();
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(session.stripe_payment_intent_id, {
        stripeAccount: session.stripe_connected_account_id,
      });

      if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing' || paymentIntent.status === 'requires_capture') {
        const finalized = await finalizeSuccessfulKioskPaymentSession({
          sessionId: session.id,
          restaurantId: session.restaurant_id,
        });
        return finalized.session;
      }

      if (paymentIntent.status !== 'canceled') {
        await stripe.paymentIntents.cancel(session.stripe_payment_intent_id, {}, { stripeAccount: session.stripe_connected_account_id });
      }
    } catch {
      // keep local cancellation path idempotent even if Stripe PI already terminal
    }
  }

  return markKioskPaymentSessionState({
    sessionId: session.id,
    nextState: 'canceled',
    restaurantId: session.restaurant_id,
    failureMessage: input.reason ?? 'Canceled by user',
    eventType: 'session_canceled',
  });
};

export const finalizeSuccessfulKioskPaymentSession = async (input: { sessionId: string; restaurantId?: string | null }) => {
  const session = await getKioskPaymentSession(input.sessionId, input.restaurantId);
  if (!session) throw new Error('Kiosk payment session not found');

  if (session.state === 'finalized') {
    return { session, paymentIntentStatus: 'succeeded' as Stripe.PaymentIntent.Status };
  }

  if (!session.stripe_payment_intent_id) throw new Error('No Stripe payment intent exists for this session');

  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.retrieve(session.stripe_payment_intent_id, {
    stripeAccount: session.stripe_connected_account_id,
  });

  if (paymentIntent.status === 'succeeded') {
    const succeeded =
      session.state === 'succeeded'
        ? session
        : await markKioskPaymentSessionState({
            sessionId: session.id,
            restaurantId: session.restaurant_id,
            nextState: 'succeeded',
            eventType: 'payment_confirmed',
            eventPayload: {
              payment_intent_id: paymentIntent.id,
              payment_intent_status: paymentIntent.status,
            },
          });

    const finalized = await markKioskPaymentSessionState({
      sessionId: succeeded.id,
      restaurantId: succeeded.restaurant_id,
      nextState: 'finalized',
      eventType: 'session_finalized',
    });

    return { session: finalized, paymentIntentStatus: paymentIntent.status };
  }

  if (paymentIntent.status === 'processing' || paymentIntent.status === 'requires_capture') {
    const needsReconciliation = await markKioskPaymentSessionState({
      sessionId: session.id,
      restaurantId: session.restaurant_id,
      nextState: 'needs_reconciliation',
      eventType: 'payment_needs_reconciliation',
      eventPayload: { payment_intent_status: paymentIntent.status },
    });

    return { session: needsReconciliation, paymentIntentStatus: paymentIntent.status };
  }

  const failed = await markKioskPaymentSessionState({
    sessionId: session.id,
    restaurantId: session.restaurant_id,
    nextState: 'failed',
    failureMessage: `Payment not successful (status: ${paymentIntent.status})`,
    eventType: 'payment_not_successful',
    eventPayload: { payment_intent_status: paymentIntent.status },
  });

  return { session: failed, paymentIntentStatus: paymentIntent.status };
};

export const reconcileAbandonedOrUnknownKioskPaymentSession = async (input: { sessionId: string; restaurantId?: string | null }) => {
  const session = await getKioskPaymentSession(input.sessionId, input.restaurantId);
  if (!session) throw new Error('Kiosk payment session not found');

  if (session.state === 'finalized' || session.state === 'canceled' || session.state === 'failed') {
    return session;
  }

  if (TERMINAL_SESSION_STATES.has(session.state) && !session.stripe_payment_intent_id) {
    return session;
  }

  if (!session.stripe_payment_intent_id) {
    return markKioskPaymentSessionState({
      sessionId: session.id,
      restaurantId: session.restaurant_id,
      nextState: 'failed',
      failureMessage: 'Missing PaymentIntent after interruption',
      eventType: 'reconciliation_missing_payment_intent',
    });
  }

  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.retrieve(session.stripe_payment_intent_id, {
    stripeAccount: session.stripe_connected_account_id,
  });

  if (paymentIntent.status === 'succeeded') {
    const finalized = await finalizeSuccessfulKioskPaymentSession({ sessionId: session.id, restaurantId: session.restaurant_id });
    return finalized.session;
  }

  if (paymentIntent.status === 'canceled') {
    return markKioskPaymentSessionState({
      sessionId: session.id,
      restaurantId: session.restaurant_id,
      nextState: 'canceled',
      eventType: 'reconciled_canceled',
    });
  }

  return markKioskPaymentSessionState({
    sessionId: session.id,
    restaurantId: session.restaurant_id,
    nextState: 'needs_reconciliation',
    eventType: 'reconciled_pending',
    eventPayload: { payment_intent_status: paymentIntent.status },
  });
};

export const isKioskSessionState = (value: string): value is KioskCardPresentSessionState => {
  try {
    assertState(value);
    return true;
  } catch {
    return false;
  }
};
