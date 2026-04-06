import { requestPrintJobCreation } from '@/lib/print-jobs/request';
import { supaServer } from '@/lib/supaServer';
import {
  cancelKioskPaymentSession,
  createKioskCardPresentSession,
  createOrRetrieveCardPresentPaymentIntentForSession,
  finalizeSuccessfulKioskPaymentSession,
  markKioskPaymentSessionState,
  verifyKioskSessionPaymentCompletion,
} from '@/lib/server/payments/kioskCardPresentService';

export type InternalSettlementMode = 'order_payment' | 'quick_charge';

export type UnpaidOrderSummary = {
  id: string;
  short_order_number: number | null;
  customer_name: string | null;
  order_type: string | null;
  status: string;
  total_price: number | null;
  created_at: string;
};

const isOrderPaymentUnpaid = (value: unknown) => {
  if (typeof value !== 'string') return true;
  return value === '' || value === 'unpaid' || value === 'failed';
};

const isCollectionOperationalType = (orderType: string | null | undefined) => {
  if (!orderType) return true;
  return orderType !== 'delivery';
};

const maybeAutoCompletePreparedOrder = async (input: { orderId: string; orderStatus: string; orderType: string | null }) => {
  if (!isCollectionOperationalType(input.orderType)) return;
  if (input.orderStatus !== 'prepared') return;

  const { error } = await supaServer
    .from('orders')
    .update({ status: 'completed' })
    .eq('id', input.orderId)
    .eq('status', 'prepared');

  if (error) {
    console.error('[internal-settlement] failed to auto-complete prepared order', {
      order_id: input.orderId,
      error: error.message,
    });
  }
};

export const listUnpaidOrdersForSettlement = async (restaurantId: string, limit = 80): Promise<UnpaidOrderSummary[]> => {
  const { data, error } = await supaServer
    .from('orders')
    .select('id,short_order_number,customer_name,order_type,status,total_price,created_at,payment_status')
    .eq('restaurant_id', restaurantId)
    .in('status', ['pending', 'accepted', 'prepared'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || [])
    .filter((row: any) => isOrderPaymentUnpaid(row.payment_status) && Number(row.total_price || 0) > 0)
    .map((row: any) => ({
      id: String(row.id),
      short_order_number: row.short_order_number == null ? null : Number(row.short_order_number),
      customer_name: row.customer_name ? String(row.customer_name) : null,
      order_type: row.order_type ? String(row.order_type) : null,
      status: String(row.status || 'pending'),
      total_price: row.total_price == null ? null : Number(row.total_price),
      created_at: String(row.created_at),
    }));
};

export const createInternalSettlementSession = async (input: {
  restaurantId: string;
  mode: InternalSettlementMode;
  idempotencyKey: string;
  currency?: string;
  orderId?: string | null;
  amountCents?: number | null;
  note?: string | null;
  reference?: string | null;
}) => {
  const mode = input.mode;
  const currency = (input.currency || 'gbp').toLowerCase();

  if (mode === 'order_payment') {
    if (!input.orderId) throw new Error('order_id is required for order payment');

    const { data: order, error } = await supaServer
      .from('orders')
      .select('id,restaurant_id,total_price,status,order_type,payment_status')
      .eq('id', input.orderId)
      .eq('restaurant_id', input.restaurantId)
      .maybeSingle();

    if (error) throw error;
    if (!order) throw new Error('Order not found');
    if (!isOrderPaymentUnpaid(order.payment_status)) throw new Error('Order is already settled');

    const orderAmount = Math.max(1, Number(order.total_price || 0));
    if (orderAmount <= 0) throw new Error('Order has no outstanding amount');

    const { error: pendingError } = await supaServer
      .from('orders')
      .update({
        payment_status: 'pending',
        payment_method: 'card_present',
        paid_at: null,
      })
      .eq('id', order.id)
      .eq('restaurant_id', input.restaurantId);

    if (pendingError) throw pendingError;

    const session = await createKioskCardPresentSession({
      restaurantId: input.restaurantId,
      orderId: String(order.id),
      amountCents: orderAmount,
      currency,
      idempotencyKey: input.idempotencyKey,
      metadata: {
        settlement_module: 'internal',
        settlement_mode: mode,
      },
    });

    return { session, amountCents: orderAmount, currency };
  }

  const customAmount = Math.max(1, Math.floor(Number(input.amountCents || 0)));
  if (!customAmount) throw new Error('amount_cents is required for quick charge');

  const session = await createKioskCardPresentSession({
    restaurantId: input.restaurantId,
    amountCents: customAmount,
    currency,
    idempotencyKey: input.idempotencyKey,
    metadata: {
      settlement_module: 'internal',
      settlement_mode: mode,
      quick_charge_note: input.note?.trim() || null,
      quick_charge_reference: input.reference?.trim() || null,
    },
  });

  return { session, amountCents: customAmount, currency };
};

export const createInternalSettlementPaymentIntent = async (input: { sessionId: string; restaurantId: string }) => {
  return createOrRetrieveCardPresentPaymentIntentForSession({
    sessionId: input.sessionId,
    restaurantId: input.restaurantId,
  });
};

export const finalizeInternalSettlement = async (input: { sessionId: string; restaurantId: string }) => {
  const finalized = await finalizeSuccessfulKioskPaymentSession({
    sessionId: input.sessionId,
    restaurantId: input.restaurantId,
  });

  const verification = await verifyKioskSessionPaymentCompletion(finalized.session);
  if (!verification.verifiedPaid) {
    await markKioskPaymentSessionState({
      sessionId: finalized.session.id,
      restaurantId: input.restaurantId,
      nextState: 'failed',
      failureCode: 'verification_failed',
      failureMessage: verification.reason,
      eventType: 'internal_settlement_verification_failed',
      eventPayload: { payment_intent_status: verification.paymentIntentStatus },
    });
    throw new Error(`Payment verification failed: ${verification.reason}`);
  }

  if (finalized.session.order_id) {
    const paidAt = new Date().toISOString();
    const { data: updatedOrder, error } = await supaServer
      .from('orders')
      .update({
        payment_status: 'paid',
        payment_method: 'card_present',
        paid_at: paidAt,
        payment_reference: finalized.session.stripe_payment_intent_id,
      })
      .eq('id', finalized.session.order_id)
      .eq('restaurant_id', input.restaurantId)
      .select('id,status,order_type,restaurant_id')
      .maybeSingle();

    if (error) throw error;

    if (updatedOrder) {
      await maybeAutoCompletePreparedOrder({
        orderId: String(updatedOrder.id),
        orderStatus: String(updatedOrder.status || ''),
        orderType: updatedOrder.order_type ? String(updatedOrder.order_type) : null,
      });

      try {
        await requestPrintJobCreation({
          restaurantId: String(updatedOrder.restaurant_id),
          orderId: String(updatedOrder.id),
          ticketType: 'invoice',
          source: 'auto',
          triggerEvent: 'payment_succeeded',
          dedupeToken: `payment_succeeded:${updatedOrder.id}`,
        });
      } catch (printError) {
        console.warn('[internal-settlement] payment settled but print job creation failed', {
          order_id: updatedOrder.id,
          error: printError,
        });
      }
    }
  }

  return {
    session: finalized.session,
    verification,
  };
};

export const cancelInternalSettlement = async (input: { sessionId: string; restaurantId: string }) => {
  const canceled = await cancelKioskPaymentSession({
    sessionId: input.sessionId,
    restaurantId: input.restaurantId,
  });

  if (canceled.order_id) {
    const { error } = await supaServer
      .from('orders')
      .update({
        payment_status: 'failed',
      })
      .eq('id', canceled.order_id)
      .eq('restaurant_id', input.restaurantId)
      .neq('payment_status', 'paid');

    if (error) {
      console.error('[internal-settlement] failed to mark order payment failed after cancellation', {
        order_id: canceled.order_id,
        error: error.message,
      });
    }
  }

  return { session: canceled };
};
