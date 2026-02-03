import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import FullscreenAppLayout from '@/components/layouts/FullscreenAppLayout';
import { supabase } from '@/lib/supabaseClient';

type AudioContextConstructor = typeof AudioContext;

type OrderAddon = {
  id: number;
  name: string;
  quantity: number;
};

type OrderItem = {
  id: number;
  name: string;
  quantity: number;
  order_addons: OrderAddon[];
};

type Order = {
  id: string;
  short_order_number: number | null;
  order_type: string;
  status: string;
  created_at: string;
  order_items: OrderItem[];
};

export default function KitchenDisplayPage() {
  const router = useRouter();
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;
  const audioContextRef = useRef<AudioContext | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [now, setNow] = useState(Date.now());

  const preferenceKey = useMemo(
    () => (restaurantId ? `kod_audio_enabled_${restaurantId}` : 'kod_audio_enabled'),
    [restaurantId]
  );
  const [soundEnabled, setSoundEnabled] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    setLoadingOrders(true);
    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        id,
        short_order_number,
        order_type,
        status,
        created_at,
        order_items(
          id,
          name,
          quantity,
          order_addons(
            id,
            name,
            quantity
          )
        )
      `
      )
      .eq('restaurant_id', restaurantId)
      .not('status', 'in', '("completed","cancelled")')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[kod] failed to load orders', error);
      setLoadingOrders(false);
      return;
    }

    setOrders((data as Order[]) ?? []);
    setLoadingOrders(false);
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    fetchOrders();
    const interval = window.setInterval(fetchOrders, 3000);
    return () => {
      window.clearInterval(interval);
    };
  }, [fetchOrders, restaurantId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleFocus = () => {
      fetchOrders();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchOrders();
      }
    };
    const handleOnline = () => {
      fetchOrders();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchOrders]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(preferenceKey);
    setSoundEnabled(stored === 'true');
  }, [preferenceKey]);

  const handleEnableSound = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const AudioContextCtor = (window.AudioContext ||
      (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext) as
      | AudioContextConstructor
      | undefined;

    if (AudioContextCtor) {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextCtor();
        }
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      } catch (err) {
        console.debug('[kod] unable to initialize audio context', err);
      }
    }

    window.localStorage.setItem(preferenceKey, 'true');
    setSoundEnabled(true);
  }, [preferenceKey]);

  const formatElapsed = useCallback((createdAt: string) => {
    const createdTime = new Date(createdAt).getTime();
    if (Number.isNaN(createdTime)) return '--';
    const totalSeconds = Math.max(0, Math.floor((now - createdTime) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }, [now]);

  return (
    <FullscreenAppLayout
      promptTitle="Tap to enter fullscreen"
      promptDescription="Kitchen Display works best in fullscreen mode."
    >
      <div className="min-h-screen w-full bg-neutral-950 text-white">
        <div className="flex min-h-screen flex-col gap-8 px-6 py-10">
          <div className="space-y-4 text-center">
            <p className="text-3xl font-semibold tracking-tight sm:text-5xl">
              Kitchen Display – Waiting for orders
            </p>
            <p className="text-base text-neutral-300 sm:text-lg">
              This screen stays ready for incoming kitchen tickets.
            </p>
          </div>
          <div className="mx-auto w-full max-w-5xl space-y-6">
            {loadingOrders ? (
              <p className="text-center text-sm text-neutral-400">Refreshing orders…</p>
            ) : null}
            {orders.length === 0 && !loadingOrders ? (
              <p className="text-center text-base text-neutral-400">
                No active orders yet.
              </p>
            ) : null}
            <div className="grid gap-6 lg:grid-cols-2">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/20"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-neutral-400">Order</p>
                      <p className="text-2xl font-semibold text-white">
                        #{order.short_order_number ?? order.id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm uppercase tracking-[0.2em] text-neutral-400">
                        {order.order_type}
                      </p>
                      <p className="text-xl font-semibold text-white">
                        {formatElapsed(order.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-4">
                    {order.order_items?.map((item) => (
                      <div key={item.id} className="space-y-2">
                        <p className="text-lg font-semibold text-white">
                          {item.quantity}× {item.name}
                        </p>
                        {item.order_addons?.length ? (
                          <div className="space-y-1 pl-6 text-sm text-neutral-300">
                            {item.order_addons.map((addon) => (
                              <p key={addon.id}>
                                {addon.quantity}× {addon.name}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleEnableSound}
            className="mx-auto rounded-full border border-white/40 bg-white/10 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-white/20"
          >
            {soundEnabled ? 'Sound enabled' : 'Tap to enable sound'}
          </button>
          {!soundEnabled ? (
            <p className="text-center text-sm text-neutral-400">
              Sound must be enabled to play alerts once orders start flowing.
            </p>
          ) : null}
        </div>
      </div>
    </FullscreenAppLayout>
  );
}
