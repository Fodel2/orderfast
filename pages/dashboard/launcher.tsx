import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';
import {
  readLauncherBootstrapSnapshot,
  runLauncherBootstrap,
  type LauncherBootstrapSnapshot,
} from '@/lib/app/launcherBootstrap';
import { resolveContactlessEligibility, resolveContactlessPresentation } from '@/lib/payments/contactlessEligibility';
import { resolveStaffTapToPayAvailability, type StaffTapToPayAvailability } from '@/lib/payments/staffTapToPayAvailability';

type RestaurantOption = {
  id: string;
  name: string;
};

type MembershipRow = {
  restaurant_id: string | null;
  restaurants:
    | {
        id?: string | null;
        name?: string | null;
      }
    | {
        id?: string | null;
        name?: string | null;
      }[]
    | null;
};

type AppMode = {
  key: 'kiosk' | 'pos' | 'kod' | 'menu' | 'take_payment';
  label: string;
  description: string;
};

const APP_MODES: AppMode[] = [
  { key: 'kiosk', label: 'Kiosk', description: 'Self-service ordering experience.' },
  { key: 'pos', label: 'POS', description: 'Front-of-house point of sale tools.' },
  { key: 'take_payment', label: 'Take Payment', description: 'Collect ad-hoc and unpaid-order card payments.' },
  { key: 'kod', label: 'KOD', description: 'Kitchen order display workflows.' },
  { key: 'menu', label: 'Menu', description: 'Customer menu preview and ordering.' },
];
const RESTAURANT_SELECTION_KEY = 'orderfast_launcher_restaurant_id';

const getRestaurantFromMembership = (row: MembershipRow): RestaurantOption | null => {
  if (!row.restaurant_id) return null;

  const related = Array.isArray(row.restaurants) ? row.restaurants[0] : row.restaurants;

  return {
    id: row.restaurant_id,
    name: related?.name?.trim() || 'Unnamed restaurant',
  };
};

const getModeHref = (mode: AppMode['key'], restaurantId: string) => {
  if (mode === 'kiosk') return `/kiosk/${restaurantId}?entry=launcher`;
  if (mode === 'pos') return `/pos/${restaurantId}`;
  if (mode === 'take_payment') return `/pos/${restaurantId}/payment-entry?source=launcher`;
  if (mode === 'kod') return `/kod/${restaurantId}`;
  return `/restaurant/menu?restaurant_id=${encodeURIComponent(restaurantId)}`;
};

export default function DashboardLauncherPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [launchingMode, setLaunchingMode] = useState<AppMode['key'] | null>(null);
  const [bootstrapSnapshot, setBootstrapSnapshot] = useState<LauncherBootstrapSnapshot | null>(null);
  const [bootstrapRunning, setBootstrapRunning] = useState(false);
  const [staffTakePaymentAvailability, setStaffTakePaymentAvailability] = useState<StaffTapToPayAvailability | null>(null);
  const [staffTakePaymentLoading, setStaffTakePaymentLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const loadLauncherContext = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (!session) {
        await router.replace('/login?redirect=/dashboard/launcher');
        return;
      }

      const { data, error: membershipError } = await supabase
        .from('restaurant_users')
        .select('restaurant_id, restaurants(id,name)')
        .eq('user_id', session.user.id);

      if (!active) return;

      if (membershipError) {
        setError('Unable to load your restaurant access right now.');
        setIsLoading(false);
        return;
      }

      const mapped = ((data as MembershipRow[] | null) || [])
        .map(getRestaurantFromMembership)
        .filter((restaurant): restaurant is RestaurantOption => Boolean(restaurant));

      const uniqueRestaurants = Array.from(new Map(mapped.map((item) => [item.id, item])).values());

      setRestaurants(uniqueRestaurants);

      if (typeof window !== 'undefined') {
        try {
          const persistedId = window.localStorage.getItem(RESTAURANT_SELECTION_KEY);
          if (persistedId && uniqueRestaurants.some((restaurant) => restaurant.id === persistedId)) {
            setSelectedRestaurantId(persistedId);
          } else if (uniqueRestaurants.length === 1) {
            setSelectedRestaurantId(uniqueRestaurants[0].id);
          }
        } catch {
          // localStorage can be unavailable in some webview contexts
        }
      } else if (uniqueRestaurants.length === 1) {
        setSelectedRestaurantId(uniqueRestaurants[0].id);
      }

      if (uniqueRestaurants.length === 0) {
        setError('No restaurant memberships were found for this account.');
      }

      setIsLoading(false);
    };

    loadLauncherContext();

    return () => {
      active = false;
    };
  }, [router]);

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) || null,
    [restaurants, selectedRestaurantId]
  );

  useEffect(() => {
    if (!selectedRestaurantId || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(RESTAURANT_SELECTION_KEY, selectedRestaurantId);
    } catch {
      // localStorage can be unavailable in some webview contexts
    }
  }, [selectedRestaurantId]);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    if (!restaurants.some((restaurant) => restaurant.id === selectedRestaurantId)) {
      setSelectedRestaurantId(null);
    }
  }, [restaurants, selectedRestaurantId]);

  const runBootstrap = useCallback(
    async (promptIfNeeded: boolean) => {
      if (!selectedRestaurant) return null;
      setBootstrapRunning(true);
      const snapshot = await runLauncherBootstrap({
        restaurantId: selectedRestaurant.id,
        promptIfNeeded,
      });
      setBootstrapSnapshot(snapshot);
      setBootstrapRunning(false);
      return snapshot;
    },
    [selectedRestaurant]
  );

  const evaluateLauncherStaffTakePaymentAvailability = useCallback(async () => {
    if (!selectedRestaurant) return null;
    setStaffTakePaymentLoading(true);
    try {
      const resolved = await resolveStaffTapToPayAvailability({
        checkpoint: 'before_render',
        entryPoint: 'take_payment',
        source: 'launcher',
      });
      console.info('[payments][contactless_eligibility]', 'launcher_staff_tap_to_pay_availability_evaluated', {
        restaurantId: selectedRestaurant.id,
        serverAvailable: resolved.serverAvailable,
        eligible: resolved.resolved.eligible,
        detail: resolved.resolved.detail,
        reason: resolved.resolved.reason,
      });
      setStaffTakePaymentAvailability(resolved);
      return resolved;
    } catch (error: any) {
      const resolved = await resolveContactlessEligibility({
        checkpoint: 'before_render',
        audience: 'staff',
        entryPoint: 'take_payment',
        restaurantAllowsContactless: false,
        entryPointSupportsContactless: true,
      });
      const fallback = {
        resolved,
        serverAvailable: false,
        serverReason: error?.message || 'Tap to Pay availability could not be confirmed.',
        httpStatus: 0,
      };
      setStaffTakePaymentAvailability(fallback);
      return fallback;
    } finally {
      setStaffTakePaymentLoading(false);
    }
  }, [selectedRestaurant]);

  useEffect(() => {
    const existing = readLauncherBootstrapSnapshot();
    if (selectedRestaurant && existing?.restaurantId === selectedRestaurant.id) {
      setBootstrapSnapshot(existing);
      if (existing.state === 'ready') return;
    }
    if (!selectedRestaurant) return;
    void runBootstrap(true);
  }, [runBootstrap, selectedRestaurant]);

  useEffect(() => {
    if (!selectedRestaurant) return;
    void evaluateLauncherStaffTakePaymentAvailability();
  }, [evaluateLauncherStaffTakePaymentAvailability, selectedRestaurant]);

  useEffect(() => {
    if (!selectedRestaurant) return;

    APP_MODES.forEach((mode) => {
      const href = getModeHref(mode.key, selectedRestaurant.id);
      router.prefetch(href).catch(() => undefined);
    });
  }, [router, selectedRestaurant]);

  const handleLaunch = async (mode: AppMode['key']) => {
    if (!selectedRestaurant) return;
    if (bootstrapRunning || staffTakePaymentLoading) return;

    setLaunchingMode(mode);
    try {
      if (mode === 'take_payment') {
        const liveAvailability = await evaluateLauncherStaffTakePaymentAvailability();
        if (!liveAvailability?.resolved?.eligible) {
          console.info('[payments][contactless_eligibility]', 'launcher_take_payment_action_disabled_due_to_live_unavailability', {
            restaurantId: selectedRestaurant.id,
            reason: liveAvailability?.resolved?.detail || null,
          });
          console.info('[payments][contactless_eligibility]', 'launcher_navigation_blocked_due_to_live_unavailability', {
            mode,
            restaurantId: selectedRestaurant.id,
            reason: liveAvailability?.resolved?.detail || null,
          });
          return;
        }
      }

      const latestSnapshot = await runBootstrap(true);
      if (!latestSnapshot) return;
      const href = getModeHref(mode, selectedRestaurant.id);
      await router.push(href);
    } finally {
      setLaunchingMode(null);
    }
  };

  const takePaymentPresentation = staffTakePaymentAvailability
    ? resolveContactlessPresentation(staffTakePaymentAvailability.resolved)
    : null;
  const takePaymentUnavailable = takePaymentPresentation?.presentation === 'disabled';

  useEffect(() => {
    if (!staffTakePaymentAvailability) return;
    if (!staffTakePaymentAvailability.resolved.eligible) {
      console.info('[payments][contactless_eligibility]', 'live_nfc_off_state_propagated_to_launcher_and_payment_actions', {
        reason: staffTakePaymentAvailability.resolved.detail,
      });
    }
  }, [staffTakePaymentAvailability]);

  useEffect(() => {
    if (!takePaymentUnavailable) return;
    console.info('[payments][contactless_eligibility]', 'launcher_take_payment_action_disabled_due_to_live_unavailability', {
      reason: takePaymentPresentation?.detail || null,
    });
  }, [takePaymentPresentation?.detail, takePaymentUnavailable]);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '1rem',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <header style={{ marginTop: '0.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', letterSpacing: '0.06em' }}>ORDERFAST</p>
          <h1 style={{ margin: '0.25rem 0 0', fontSize: '1.5rem' }}>App launcher</h1>
          <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Choose your destination and continue with your current restaurant context.
          </p>
        </header>

        {isLoading ? <p style={{ color: '#334155' }}>Loading your access…</p> : null}
        {!isLoading && error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        {!isLoading && !error && bootstrapRunning ? <p style={{ color: '#334155' }}>Running launcher bootstrap…</p> : null}

        {!isLoading && !error && !selectedRestaurant && restaurants.length > 1 ? (
          <section
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '0.9rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1rem' }}>Choose a restaurant</h2>
            {restaurants.map((restaurant) => (
              <button
                key={restaurant.id}
                type="button"
                onClick={() => setSelectedRestaurantId(restaurant.id)}
                style={{
                  textAlign: 'left',
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  fontWeight: 600,
                }}
              >
                {restaurant.name}
              </button>
            ))}
          </section>
        ) : null}

        {!isLoading && !error && selectedRestaurant ? (
          <>
            <section
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '0.9rem',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Selected restaurant</p>
              <p style={{ margin: '0.3rem 0 0', fontWeight: 700 }}>{selectedRestaurant.name}</p>
              {restaurants.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setSelectedRestaurantId(null)}
                  style={{
                    marginTop: '0.6rem',
                    border: 'none',
                    background: 'transparent',
                    color: '#2563eb',
                    padding: 0,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  Switch restaurant
                </button>
              ) : null}
            </section>

            {bootstrapSnapshot && bootstrapSnapshot.state !== 'ready' ? (
              <section
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '12px',
                  padding: '0.85rem',
                }}
              >
                <p style={{ margin: 0, fontWeight: 700, color: '#92400e', fontSize: '0.9rem' }}>
                  Setup required: {bootstrapSnapshot.state.replace(/_/g, ' ')}
                </p>
                <p style={{ margin: '0.35rem 0 0', color: '#92400e', fontSize: '0.82rem' }}>{bootstrapSnapshot.reason}</p>
              </section>
            ) : null}

            <button
              type="button"
              onClick={() => handleLaunch('kiosk')}
              disabled={launchingMode !== null || bootstrapRunning}
              style={{
                textAlign: 'left',
                background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                color: '#fff',
                border: '1px solid #0f172a',
                borderRadius: '14px',
                padding: '1rem',
                boxShadow: '0 10px 24px rgba(15, 23, 42, 0.2)',
                opacity: launchingMode && launchingMode !== 'kiosk' ? 0.65 : 1,
              }}
            >
              <span style={{ display: 'block', fontWeight: 700, fontSize: '1rem' }}>
                {launchingMode === 'kiosk' ? 'Opening kiosk…' : 'Open Kiosk'}
              </span>
              <span style={{ display: 'block', marginTop: '0.3rem', color: '#cbd5e1', fontSize: '0.88rem' }}>
                Launches directly into the kiosk route for {selectedRestaurant.name}.
              </span>
            </button>

            <section
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '0.75rem',
              }}
            >
              {APP_MODES.filter((mode) => mode.key !== 'kiosk').map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => {
                    handleLaunch(mode.key).catch(() => undefined);
                  }}
                  disabled={launchingMode !== null || bootstrapRunning || staffTakePaymentLoading || (mode.key === 'take_payment' && takePaymentUnavailable)}
                  style={{
                    textAlign: 'left',
                    borderRadius: '12px',
                    padding: '0.9rem',
                    opacity: launchingMode === null || launchingMode === mode.key ? 1 : 0.65,
                    cursor: mode.key === 'take_payment' && takePaymentUnavailable ? 'not-allowed' : 'pointer',
                    border: mode.key === 'take_payment' && takePaymentUnavailable ? '1px solid #f1f5f9' : '1px solid #dbeafe',
                    background: mode.key === 'take_payment' && takePaymentUnavailable ? '#f8fafc' : '#fff',
                  }}
                >
                  <span style={{ display: 'block', fontWeight: 700 }}>
                    {mode.key === 'take_payment' && takePaymentUnavailable
                      ? 'Take Payment unavailable'
                      : launchingMode === mode.key
                        ? `Opening ${mode.label}…`
                        : mode.label}
                  </span>
                  <span style={{ display: 'block', marginTop: '0.25rem', color: '#475569', fontSize: '0.9rem' }}>
                    {mode.key === 'take_payment' && takePaymentUnavailable
                      ? takePaymentPresentation?.detail || 'Tap to Pay is unavailable on this device right now.'
                      : mode.description}
                  </span>
                </button>
              ))}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
