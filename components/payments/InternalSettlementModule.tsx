import { useCallback, useEffect, useMemo, useState } from 'react';
import { tapToPayBridge } from '@/lib/kiosk/tapToPayBridge';
import { formatPrice } from '@/lib/orderDisplay';

type SettlementMode = 'order_payment' | 'quick_charge';
type CollectionState = 'idle' | 'preparing' | 'collecting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'unavailable';

type UnpaidOrder = {
  id: string;
  short_order_number: number | null;
  customer_name: string | null;
  order_type: string | null;
  status: string;
  total_price: number | null;
  created_at: string;
};

const toCurrencyCode = (value?: string | null) => (value || 'GBP').toUpperCase();

const makeIdempotencyKey = (prefix: string) => `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

export default function InternalSettlementModule() {
  const [mode, setMode] = useState<SettlementMode>('order_payment');
  const [orders, setOrders] = useState<UnpaidOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  const [quickAmount, setQuickAmount] = useState('0.00');
  const [quickNote, setQuickNote] = useState('');
  const [quickReference, setQuickReference] = useState('');

  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<CollectionState>('idle');
  const [message, setMessage] = useState('Ready to collect payment.');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeTerminalLocationId, setActiveTerminalLocationId] = useState<string | null>(null);

  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId) || null, [orders, selectedOrderId]);

  const amountCents = useMemo(() => {
    if (mode === 'order_payment') return Number(selectedOrder?.total_price || 0);
    const numeric = Number(quickAmount);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.round(numeric * 100);
  }, [mode, quickAmount, selectedOrder?.total_price]);

  const amountLabel = useMemo(() => formatPrice(amountCents / 100), [amountCents]);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const response = await fetch('/api/dashboard/internal-settlement/unpaid-orders');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
      const nextOrders = Array.isArray(payload?.orders) ? (payload.orders as UnpaidOrder[]) : [];
      setOrders(nextOrders);
      if (nextOrders.length > 0 && !nextOrders.some((order) => order.id === selectedOrderId)) {
        setSelectedOrderId(nextOrders[0].id);
      }
    } catch (error: any) {
      setMessage(error?.message || 'Failed to load unpaid orders.');
      setState('failed');
    } finally {
      setLoadingOrders(false);
    }
  }, [selectedOrderId]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const isUnsupportedDeviceError = (code?: string) => code === 'unsupported' || code === 'unsupported_device';

  const handleCollectContactless = useCallback(async () => {
    if (busy) return;
    if (mode === 'order_payment' && !selectedOrderId) {
      setState('failed');
      setMessage('Select an unpaid order first.');
      return;
    }
    if (amountCents <= 0) {
      setState('failed');
      setMessage('Amount must be greater than zero.');
      return;
    }

    setBusy(true);
    setState('preparing');
    setMessage('Checking Tap to Pay readiness…');

    let sessionIdForCleanup: string | null = null;
    try {
      const readinessRes = await fetch('/api/dashboard/internal-settlement/tap-to-pay-availability');
      const readinessPayload = await readinessRes.json().catch(() => ({}));
      if (!readinessRes.ok || !readinessPayload?.tap_to_pay_available) {
        setState('unavailable');
        setMessage(readinessPayload?.reason || 'Tap to Pay is not available for this restaurant.');
        return;
      }

      const createRes = await fetch('/api/dashboard/internal-settlement/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          idempotency_key: makeIdempotencyKey('internal_settlement'),
          order_id: mode === 'order_payment' ? selectedOrderId : null,
          amount_cents: mode === 'quick_charge' ? amountCents : undefined,
          currency: 'gbp',
          note: mode === 'quick_charge' ? quickNote : undefined,
          reference: mode === 'quick_charge' ? quickReference : undefined,
        }),
      });
      const createPayload = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(createPayload?.message || `Failed to create payment session (${createRes.status})`);

      const sessionId = createPayload?.session?.id ? String(createPayload.session.id) : '';
      const terminalLocationId = createPayload?.session?.stripe_terminal_location_id
        ? String(createPayload.session.stripe_terminal_location_id)
        : '';

      if (!sessionId || !terminalLocationId) throw new Error('Missing payment session context.');
      sessionIdForCleanup = sessionId;
      setActiveSessionId(sessionId);
      setActiveTerminalLocationId(terminalLocationId);

      await fetch('/api/dashboard/internal-settlement/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });

      const support = await tapToPayBridge.isTapToPaySupported();
      if (!support.supported) {
        setState('unavailable');
        setMessage(support.reason || 'This device cannot run Tap to Pay.');
        await fetch('/api/dashboard/internal-settlement/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
        return;
      }

      const setup = await tapToPayBridge.ensureTapToPaySetup({ promptIfNeeded: true });
      if (!setup.ready) {
        setState('unavailable');
        setMessage(setup.reason || 'Tap to Pay setup is incomplete on this device.');
        await fetch('/api/dashboard/internal-settlement/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
        return;
      }

      setState('collecting');
      setMessage('Present card/phone to collect payment…');

      const nativeResult = await tapToPayBridge.startTapToPayPayment({
        restaurantId: 'internal-settlement',
        sessionId,
        backendBaseUrl: window.location.origin,
        terminalLocationId,
      });

      if (nativeResult.status === 'canceled') {
        setState('canceled');
        setMessage(nativeResult.message || 'Payment canceled.');
        await fetch('/api/dashboard/internal-settlement/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
        return;
      }

      if (nativeResult.status !== 'succeeded') {
        setState(isUnsupportedDeviceError(nativeResult.code) ? 'unavailable' : 'failed');
        setMessage(nativeResult.message || 'Payment failed.');
        await fetch('/api/dashboard/internal-settlement/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
        return;
      }

      setState('processing');
      setMessage('Finalizing settlement…');

      const finalizeRes = await fetch('/api/dashboard/internal-settlement/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const finalizePayload = await finalizeRes.json().catch(() => ({}));
      if (!finalizeRes.ok) throw new Error(finalizePayload?.message || `Failed to finalize settlement (${finalizeRes.status})`);

      setState('succeeded');
      setMessage(mode === 'order_payment' ? 'Order payment collected successfully.' : 'Quick charge collected successfully.');

      if (mode === 'quick_charge') {
        setQuickAmount('0.00');
        setQuickNote('');
        setQuickReference('');
      }

      await loadOrders();
    } catch (error: any) {
      setState('failed');
      setMessage(error?.message || 'Payment failed.');
      if (sessionIdForCleanup) {
        await fetch('/api/dashboard/internal-settlement/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionIdForCleanup }),
        }).catch(() => undefined);
      }
    } finally {
      setBusy(false);
    }
  }, [amountCents, busy, loadOrders, mode, quickNote, quickReference, selectedOrderId]);

  const handleCancel = useCallback(async () => {
    if (!activeSessionId) return;
    setBusy(true);
    try {
      await fetch('/api/dashboard/internal-settlement/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeSessionId }),
      });
      setState('canceled');
      setMessage('Payment canceled.');
      setActiveSessionId(null);
      setActiveTerminalLocationId(null);
      await loadOrders();
    } finally {
      setBusy(false);
    }
  }, [activeSessionId, loadOrders]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Internal settlement module</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Internal collection</h1>

      <div className="mt-6 flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode('order_payment')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            mode === 'order_payment' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Order payment
        </button>
        <button
          type="button"
          onClick={() => setMode('quick_charge')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            mode === 'quick_charge' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Quick charge
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Amount</h2>
          {mode === 'order_payment' ? (
            <>
              <label className="block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Unpaid order</label>
              <select
                value={selectedOrderId}
                onChange={(event) => setSelectedOrderId(event.target.value)}
                disabled={loadingOrders || busy}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {orders.length === 0 ? <option value="">No unpaid orders</option> : null}
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    #{order.short_order_number ?? '—'} · {order.customer_name || 'Guest'} · {formatPrice(Number(order.total_price || 0) / 100)}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label className="block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Custom amount ({toCurrencyCode('gbp')})</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={quickAmount}
                onChange={(event) => setQuickAmount(event.target.value)}
                disabled={busy}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={quickReference}
                onChange={(event) => setQuickReference(event.target.value)}
                disabled={busy}
                placeholder="Reference (optional)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <textarea
                value={quickNote}
                onChange={(event) => setQuickNote(event.target.value)}
                disabled={busy}
                placeholder="Note (optional)"
                className="min-h-[84px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </>
          )}
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Amount to collect</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{amountLabel}</p>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Payment method</h2>
          <p className="text-sm text-slate-600">Contactless card-present via Tap to Pay</p>

          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              state === 'succeeded'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : state === 'failed' || state === 'canceled'
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : state === 'unavailable'
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            <p className="font-semibold">Collection state: {state.replace('_', ' ')}</p>
            <p className="mt-1 text-xs">{message}</p>
            {activeSessionId ? <p className="mt-2 text-[11px] text-slate-500">Session: {activeSessionId}</p> : null}
            {activeTerminalLocationId ? (
              <p className="mt-1 text-[11px] text-slate-500">Terminal location: {activeTerminalLocationId}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy || amountCents <= 0 || (mode === 'order_payment' && !selectedOrderId)}
              onClick={handleCollectContactless}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy ? 'Collecting…' : 'Collect contactless'}
            </button>
            <button
              type="button"
              disabled={busy || !activeSessionId}
              onClick={handleCancel}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel session
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
