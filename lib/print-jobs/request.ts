export type PrintTicketType = 'kot' | 'invoice';
export type PrintSource = 'auto' | 'manual_print' | 'manual_reprint' | 'retry' | 'test';

const normalizeTicketTypeForPayload = (ticketType: string): PrintTicketType => {
  return String(ticketType).trim().toLowerCase() === 'invoice' ? 'invoice' : 'kot';
};

export async function requestPrintJobCreation(params: {
  restaurantId: string;
  orderId: string;
  ticketType: PrintTicketType;
  source: PrintSource;
  triggerEvent?: 'order_placed' | 'payment_succeeded' | 'order_accepted' | 'scheduled_prep_window';
  dedupeToken?: string;
}) {
  const normalizedTicketType = normalizeTicketTypeForPayload(String(params.ticketType));

  const payload = {
    restaurant_id: params.restaurantId,
    order_id: params.orderId,
    ticket_type: normalizedTicketType,
    source: params.source,
    trigger_event: params.triggerEvent,
    dedupe_token: params.dedupeToken,
  };

  if (params.source === 'manual_print') {
    console.info('[print-jobs/request] manual ticket_type payload', {
      source: params.source,
      ticket_type: payload.ticket_type,
    });
  }

  const response = await fetch('/api/print-jobs/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || 'Unable to queue print job');
  }

  return response.json();
}


export async function requestPrintQueueNudge(params: { restaurantId: string; batchSize?: number }) {
  const response = await fetch('/api/print-jobs/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurant_id: params.restaurantId,
      batch_size: params.batchSize ?? 5,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || 'Unable to process print queue');
  }

  return response.json();
}
