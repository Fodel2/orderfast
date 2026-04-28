import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  BuildingStorefrontIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  QueueListIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
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
  icon: any;
};

const APP_MODES: AppMode[] = [
  {
    key: 'pos',
    label: 'POS',
    description: 'Serve walk-ins, build orders, and manage front-of-house sales.',
    icon: Squares2X2Icon,
  },
  {
    key: 'take_payment',
    label: 'Take Payment',
    description: 'Take quick card payments or collect unpaid orders.',
    icon: CreditCardIcon,
  },
  {
    key: 'kiosk',
    label: 'Open Kiosk',
    description: 'Start customer self-ordering for your selected restaurant.',
    icon: DevicePhoneMobileIcon,
  },
  {
    key: 'kod',
    label: 'KOD',
    description: 'View live kitchen tickets and preparation status.',
    icon: QueueListIcon,
  },
  {
    key: 'menu',
    label: 'Menu',
    description: 'Preview the customer menu and ordering experience.',
    icon: BuildingStorefrontIcon,
  },
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
  const refreshInFlightRef = useRef(false);
  const lastRefreshAtRef = useRef(0);

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

  const refreshLauncherTapToPayState = useCallback(
    async (trigger: string, options?: { promptIfNeeded?: boolean; skipThrottle?: boolean }) => {
      if (!selectedRestaurant) return;
      const now = Date.now();
      const shouldThrottle = options?.skipThrottle !== true && now - lastRefreshAtRef.current < 1200;
      if (refreshInFlightRef.current || shouldThrottle) return;

      refreshInFlightRef.current = true;
      lastRefreshAtRef.current = now;
      try {
        console.info('[payments][contactless_eligibility]', 'launcher_eligibility_refresh_triggered', {
          trigger,
          restaurantId: selectedRestaurant.id,
          promptIfNeeded: options?.promptIfNeeded === true,
        });
        await runBootstrap(options?.promptIfNeeded === true);
        await evaluateLauncherStaffTakePaymentAvailability();
      } finally {
        refreshInFlightRef.current = false;
      }
    },
    [evaluateLauncherStaffTakePaymentAvailability, runBootstrap, selectedRestaurant]
  );

  useEffect(() => {
    const existing = readLauncherBootstrapSnapshot();
    if (selectedRestaurant && existing?.restaurantId === selectedRestaurant.id) {
      setBootstrapSnapshot(existing);
      if (existing.state === 'ready') return;
    }
    if (!selectedRestaurant) return;
    void refreshLauncherTapToPayState('launcher_selected_restaurant', { promptIfNeeded: true, skipThrottle: true });
  }, [refreshLauncherTapToPayState, selectedRestaurant]);

  useEffect(() => {
    if (!selectedRestaurant) return undefined;

    const refreshOnReturn = () => {
      void refreshLauncherTapToPayState('launcher_visible_or_focus', { promptIfNeeded: false });
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshOnReturn();
      }
    };

    window.addEventListener('focus', refreshOnReturn);
    window.addEventListener('pageshow', refreshOnReturn);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', refreshOnReturn);
      window.removeEventListener('pageshow', refreshOnReturn);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshLauncherTapToPayState, selectedRestaurant]);

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
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
        paddingRight: '1rem',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.2rem)',
        paddingLeft: '1rem',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: '430px', display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
        <header
          style={{
            borderRadius: '24px',
            padding: '1rem 1rem 1.05rem',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
            marginTop: '0.1rem',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#6b7280', letterSpacing: '0.1em', fontWeight: 700 }}>ORDERFAST</p>
          <h1 style={{ margin: '0.35rem 0 0', fontSize: '1.35rem', color: '#111827' }}>App launcher</h1>
          <p style={{ margin: '0.55rem 0 0', color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.4 }}>
            Choose where to continue and keep working in your current restaurant context.
          </p>
        </header>

        {isLoading ? <p style={{ color: '#1e293b', margin: 0, fontWeight: 600 }}>Loading your access…</p> : null}
        {!isLoading && error ? <p style={{ color: '#b91c1c', margin: 0, fontWeight: 600 }}>{error}</p> : null}
        {!isLoading && !error && bootstrapRunning ? <p style={{ color: '#1e293b', margin: 0 }}>Running launcher bootstrap…</p> : null}

        {!isLoading && !error && !selectedRestaurant && restaurants.length > 1 ? (
          <section
            style={{
              background: 'rgba(255,255,255,0.92)',
              border: '1px solid #e5e7eb',
              borderRadius: '20px',
              padding: '0.95rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              boxShadow: '0 12px 30px rgba(30, 41, 59, 0.08)',
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
                  borderRadius: '11px',
                  border: '1px solid #e5e7eb',
                  background: '#f8fafc',
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
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '999px',
                padding: '0.45rem 0.8rem',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.6rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    width: '1.55rem',
                    height: '1.55rem',
                    borderRadius: '999px',
                    background: '#ccfbf1',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0f766e',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    flexShrink: 0,
                  }}
                >
                  R
                </span>
                <p style={{ margin: 0, fontSize: '0.86rem', color: '#1e293b', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedRestaurant.name}
                </p>
              </div>
              {restaurants.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setSelectedRestaurantId(null)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#0f766e',
                    padding: 0,
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Switch
                </button>
              ) : null}
            </section>

            {bootstrapSnapshot && bootstrapSnapshot.state !== 'ready' ? (
              <section
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '14px',
                  padding: '0.9rem',
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
              onClick={() => handleLaunch('pos')}
              disabled={launchingMode !== null || bootstrapRunning}
              style={{
                textAlign: 'left',
                background: '#ffffff',
                color: '#111827',
                border: '1px solid #0d9488',
                borderRadius: '24px',
                padding: '1.05rem',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.1)',
                opacity: launchingMode && launchingMode !== 'pos' ? 0.65 : 1,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.8rem',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '0.7rem',
                  background: '#ccfbf1',
                  border: '1px solid #99f6e4',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0f766e',
                  fontSize: '1rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                <Squares2X2Icon style={{ width: '1.1rem', height: '1.1rem' }} />
              </span>
              <span style={{ display: 'block' }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: '1rem' }}>
                  {launchingMode === 'pos' ? 'Opening POS…' : 'POS'}
                </span>
                <span style={{ display: 'block', marginTop: '0.3rem', color: '#4b5563', fontSize: '0.88rem' }}>
                  Serve walk-ins, build orders, and manage front-of-house sales for {selectedRestaurant.name}.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleLaunch('take_payment').catch(() => undefined);
              }}
              disabled={launchingMode !== null || bootstrapRunning || staffTakePaymentLoading || takePaymentUnavailable}
              style={{
                textAlign: 'left',
                borderRadius: '20px',
                padding: '1rem',
                opacity: launchingMode === null || launchingMode === 'take_payment' ? 1 : 0.65,
                cursor: takePaymentUnavailable ? 'not-allowed' : 'pointer',
                border: takePaymentUnavailable ? '1px solid #e5e7eb' : '1px solid #5eead4',
                background: takePaymentUnavailable ? '#f8fafc' : '#f0fdfa',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.72rem',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '1.9rem',
                  height: '1.9rem',
                  borderRadius: '0.68rem',
                  background: takePaymentUnavailable ? '#f3f4f6' : '#ccfbf1',
                  border: takePaymentUnavailable ? '1px solid #e5e7eb' : '1px solid #99f6e4',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: takePaymentUnavailable ? '#9ca3af' : '#0f766e',
                  flexShrink: 0,
                }}
              >
                <CreditCardIcon style={{ width: '1.05rem', height: '1.05rem' }} />
              </span>
              <span style={{ display: 'block' }}>
                <span style={{ display: 'block', fontWeight: 700 }}>
                  {takePaymentUnavailable
                    ? 'Take Payment unavailable'
                    : launchingMode === 'take_payment'
                      ? 'Opening Take Payment…'
                      : 'Take Payment'}
                </span>
                <span style={{ display: 'block', marginTop: '0.25rem', color: '#4b5563', fontSize: '0.9rem' }}>
                  {takePaymentUnavailable
                    ? takePaymentPresentation?.detail || 'Tap to Pay is unavailable on this device right now.'
                    : 'Take quick card payments or collect unpaid orders.'}
                </span>
              </span>
            </button>

            <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.7rem' }}>
              {APP_MODES.filter((mode) => mode.key !== 'pos' && mode.key !== 'take_payment').map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => {
                    handleLaunch(mode.key).catch(() => undefined);
                  }}
                  disabled={launchingMode !== null || bootstrapRunning || staffTakePaymentLoading}
                  style={{
                    textAlign: 'left',
                    borderRadius: '14px',
                    padding: '0.95rem',
                    opacity: launchingMode === null || launchingMode === mode.key ? 1 : 0.65,
                    border: '1px solid #e5e7eb',
                    background: '#ffffff',
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.72rem',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: '1.9rem',
                      height: '1.9rem',
                      borderRadius: '0.68rem',
                      background: '#f3f4f6',
                      border: '1px solid #e5e7eb',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#4b5563',
                      flexShrink: 0,
                    }}
                  >
                    <mode.icon style={{ width: '1.05rem', height: '1.05rem' }} />
                  </span>
                  <span style={{ display: 'block' }}>
                    <span style={{ display: 'block', fontWeight: 700 }}>
                      {launchingMode === mode.key ? `Opening ${mode.label}…` : mode.label}
                    </span>
                    <span style={{ display: 'block', marginTop: '0.25rem', color: '#4b5563', fontSize: '0.9rem' }}>
                      {mode.description}
                    </span>
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
