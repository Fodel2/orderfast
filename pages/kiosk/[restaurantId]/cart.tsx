import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence, motion } from 'framer-motion';
import CartDrawer from '@/components/CartDrawer';
import KioskLayout from '@/components/layouts/KioskLayout';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabaseClient';
import KioskActionButton from '@/components/kiosk/KioskActionButton';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';

type Restaurant = {
  id: string;
  name: string;
  website_title?: string | null;
  website_description?: string | null;
  logo_url?: string | null;
  theme_primary_color?: string | null;
  menu_header_image_url?: string | null;
  menu_header_image_updated_at?: string | null;
  menu_header_focal_x?: number | null;
  menu_header_focal_y?: number | null;
};

export default function KioskCartPage() {
  const router = useRouter();
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;
  const { cart, subtotal, clearCart } = useCart();
  const cartCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const placeOrderDisabled = cartCount === 0;
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [namePromptMessage, setNamePromptMessage] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [nameError, setNameError] = useState('');
  const [showIdleModal, setShowIdleModal] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(10);
  const [idleMessage, setIdleMessage] = useState('');
  const idleTimeoutRef = useRef<number | null>(null);
  const idleCountdownIntervalRef = useRef<number | null>(null);
  const modalOverlayStyle = {
    height: '100dvh',
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    overflow: 'hidden',
  } as const;
  const modalCardStyle = {
    maxHeight: 'calc(100dvh - 32px - env(safe-area-inset-bottom))',
  } as const;

  const confirmMessages = useMemo(
    () => [
      'Everything look right? Now’s your moment of truth.',
      'Spot anything odd? Maybe it’s your order. Maybe it’s your life choices.',
      'Quick check — the kitchen takes this personally.',
      'Anything missing? Extra sauce? Emotional support items?',
      'You’re almost there. Just confirm you’re not ordering by accident.',
      'Is everything correct? Pretend we care — we actually do.',
      'Before you blame the chef, double-check your order.',
      'Review your order, because we don\'t accept responsibility for your hunger-related decisions.',
      'Take a second look. We’ll wait. The kitchen won’t.',
      'Everything perfect? Pinky promise?',
      'Double-check. Triple-check. Mega-check.',
      'Before we send this to the kitchen gods…',
      'Final chance! The tortilla cannot be unwrapped once wrapped.',
      'Ready? Because our chefs definitely are not.',
    ],
    []
  );

  const nameMessages = useMemo(
    () => [
      'Who we gonna call?',
      'What name should we shout when it’s ready?',
      'Tell us the name of the chosen one.',
      'Who shall we summon when your order is complete?',
      'A name, please. Preferably your own.',
      'What do we yell when your food is done?',
      'Write down something we can shout confidently across the room.',
      'Give us a name worthy of a sizzling plate.',
      'Your legendary name goes here.',
      'Be honest. What should we call you today?',
      'Your food needs a name. So do you.',
      'Enter your government-approved food-collection alias.',
    ],
    []
  );

  const getRandomMessage = useCallback(
    (list: string[]) => list[Math.floor(Math.random() * list.length)],
    []
  );

  const idleMessages = useMemo(
    () => [
      'Just checking… did you wander off?',
      'You still there? Or did a pigeon steal your attention?',
      'We haven’t heard from you. Should we alert the missing-persons unit?',
      'Do you require adult supervision?',
      'If you don’t press something, the kiosk WILL win.',
      'Move your finger if you can hear us.',
      'This screen will self-destruct in 10 seconds. Kidding. Mostly.',
      'We’re not clingy. We just need a tiny tap to know you’re alive.',
      'If you’re thinking, take your time. If you’re napping, we’re impressed.',
    ],
    []
  );

  const resetKioskToStart = useCallback(() => {
    clearCart();
    setShowConfirmModal(false);
    setConfirmStep(1);
    setCustomerName('');
    setNameError('');
    setNamePromptMessage('');
    setConfirmMessage('');
    if (restaurantId) {
      router.push(`/kiosk/${restaurantId}/menu`);
    } else {
      router.push('/kiosk');
    }
  }, [clearCart, restaurantId, router]);

  const handleIdleTimeout = useCallback(() => {
    setShowIdleModal(false);
    if (idleCountdownIntervalRef.current) {
      clearInterval(idleCountdownIntervalRef.current);
      idleCountdownIntervalRef.current = null;
    }
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    resetKioskToStart();
  }, [resetKioskToStart]);

  const startIdleCountdown = useCallback(() => {
    if (idleCountdownIntervalRef.current) {
      clearInterval(idleCountdownIntervalRef.current);
    }
    setIdleCountdown(10);
    idleCountdownIntervalRef.current = window.setInterval(() => {
      setIdleCountdown((prev) => {
        if (prev <= 1) {
          if (idleCountdownIntervalRef.current) {
            clearInterval(idleCountdownIntervalRef.current);
            idleCountdownIntervalRef.current = null;
          }
          handleIdleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleIdleTimeout]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    if (showIdleModal) return;
    idleTimeoutRef.current = window.setTimeout(() => {
      idleTimeoutRef.current = null;
      setIdleMessage(getRandomMessage(idleMessages));
      setIdleCountdown(10);
      setShowIdleModal(true);
      startIdleCountdown();
    }, 30000);
  }, [getRandomMessage, idleMessages, showIdleModal, startIdleCountdown]);

  const registerActivity = useCallback(() => {
    resetIdleTimer();
  }, [resetIdleTimer]);

  const handleIdleStay = useCallback(() => {
    if (idleCountdownIntervalRef.current) {
      clearInterval(idleCountdownIntervalRef.current);
      idleCountdownIntervalRef.current = null;
    }
    setShowIdleModal(false);
    setIdleCountdown(10);
    resetIdleTimer();
  }, [resetIdleTimer]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (idleCountdownIntervalRef.current) clearInterval(idleCountdownIntervalRef.current);
    };
  }, [resetIdleTimer]);

  useEffect(() => {
    if (!restaurantId) return;
    let active = true;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select(
            'id,name,website_title,website_description,logo_url,theme_primary_color,menu_header_image_url,menu_header_image_updated_at,menu_header_focal_x,menu_header_focal_y'
          )
          .eq('id', restaurantId)
          .maybeSingle();

        if (!active) return;
        if (error) {
          console.error('[kiosk] failed to fetch restaurant', error);
        }
        setRestaurant((data as Restaurant) || null);
      } catch (err) {
        if (!active) return;
        console.error('[kiosk] failed to load restaurant info', err);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [restaurantId]);

  const headerContent = useMemo(() => {
    if (!restaurantId) return null;
    return (
      <div className="mx-auto flex h-full w-full max-w-5xl items-start px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] sm:px-6">
        <button
          type="button"
          onClick={() => router.push(`/kiosk/${restaurantId}/menu`)}
          className="inline-flex min-h-[3rem] items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 text-base font-semibold text-neutral-900 shadow-md shadow-slate-300/70 ring-1 ring-slate-200 transition hover:-translate-y-[1px] hover:shadow-lg sm:text-lg"
        >
          <ChevronLeftIcon className="h-6 w-6" />
          Back
        </button>
      </div>
    );
  }, [restaurantId, router]);

  const placeOrder = () => {
    if (!restaurantId) return;
    router.push(`/kiosk/${restaurantId}/confirm`);
  };

  const openConfirmModal = () => {
    registerActivity();
    setConfirmStep(1);
    setConfirmMessage(getRandomMessage(confirmMessages));
    setCustomerName('');
    setNameError('');
    setNamePromptMessage('');
    setShowConfirmModal(true);
  };

  const goToNameStep = () => {
    registerActivity();
    setNamePromptMessage(getRandomMessage(nameMessages));
    setConfirmStep(2);
  };

  const handlePlaceOrder = () => {
    registerActivity();
    if (!customerName.trim()) {
      setNameError('We need something to call you!');
      return;
    }
    setNameError('');
    placeOrder();
    setShowConfirmModal(false);
  };

  const handleBackToReview = () => {
    registerActivity();
    setConfirmStep(1);
    setNameError('');
  };

  return (
    <KioskLayout
      restaurantId={restaurantId}
      restaurant={restaurant}
      cartCount={cartCount}
      customHeaderContent={headerContent}
    >
      <div className="mx-auto w-full max-w-5xl space-y-4 pb-28 pt-2 sm:space-y-5 sm:pt-3">
        <div className="space-y-1 px-2 sm:px-0">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-[26px]">Review your order</h1>
          <p className="text-base leading-relaxed text-slate-600 sm:text-lg">Check your items before placing your order.</p>
        </div>
        <CartDrawer inline onInteraction={registerActivity} />
      </div>
      {restaurantId ? (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 shadow-[0_-8px_40px_rgba(15,23,42,0.14)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-3.5">
            <div className="flex flex-1 flex-col gap-1 text-slate-900">
              <span className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Subtotal</span>
              <span className="text-xl font-semibold sm:text-2xl">${(subtotal / 100).toFixed(2)}</span>
              <span className="text-xs text-slate-500 sm:text-sm">Includes items and add-ons</span>
            </div>
            <div className="flex-1 sm:flex-none sm:w-80">
              <KioskActionButton
                onClick={openConfirmModal}
                aria-disabled={placeOrderDisabled}
                className={`w-full justify-center rounded-2xl px-6 py-3 text-lg font-bold uppercase tracking-wide shadow-xl shadow-slate-900/15 min-h-[3.25rem] ${
                  placeOrderDisabled ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                Place Order
              </KioskActionButton>
            </div>
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {showConfirmModal ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
            style={modalOverlayStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-900/20"
              style={modalCardStyle}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <div className="modalContent flex-1 overflow-y-auto overscroll-contain px-6 py-6 sm:px-8 sm:py-8">
                <AnimatePresence mode="wait">
                  {confirmStep === 1 ? (
                    <motion.div
                      key="confirm-step"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="flex min-h-[260px] flex-col gap-6"
                    >
                      <div className="space-y-2">
                        <h3 className="text-2xl font-semibold text-neutral-900 sm:text-[26px]">Is everything correct?</h3>
                        <p className="text-base leading-relaxed text-neutral-600 sm:text-lg">{confirmMessage}</p>
                      </div>
                      <div className="mt-auto grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => {
                            registerActivity();
                            setShowConfirmModal(false);
                          }}
                          className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 px-4 py-3 text-base font-semibold text-neutral-800 transition hover:bg-neutral-50"
                        >
                          Go back
                        </button>
                        <KioskActionButton
                          onClick={goToNameStep}
                          className="w-full justify-center rounded-2xl px-4 py-3 text-base font-semibold uppercase tracking-wide shadow-lg shadow-slate-900/15"
                        >
                          Looks good!
                        </KioskActionButton>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="name-step"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="flex min-h-[260px] flex-col gap-5"
                    >
                      <div className="space-y-2.5">
                        <h3 className="text-2xl font-semibold text-neutral-900 sm:text-[26px]">{namePromptMessage}</h3>
                        <p className="text-base leading-relaxed text-neutral-600 sm:text-lg">
                          This is the name we’ll shout when your order is ready.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => {
                            registerActivity();
                            setCustomerName(e.target.value);
                          }}
                          placeholder="Enter your name…"
                          className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-lg font-semibold text-neutral-900 shadow-inner shadow-neutral-200/70 outline-none transition focus:border-[var(--kiosk-accent,#111827)]/60 focus:bg-white"
                        />
                        {nameError ? (
                          <p className="text-sm font-semibold text-rose-600">{nameError}</p>
                        ) : null}
                      </div>
                      <div className="mt-auto grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={handleBackToReview}
                          className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 px-4 py-3 text-base font-semibold text-neutral-800 transition hover:bg-neutral-50"
                        >
                          Back
                        </button>
                        <KioskActionButton
                          onClick={handlePlaceOrder}
                          className="w-full justify-center rounded-2xl px-4 py-3 text-base font-semibold uppercase tracking-wide shadow-lg shadow-slate-900/15"
                        >
                          Place order
                        </KioskActionButton>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showIdleModal ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
            style={modalOverlayStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex w-full max-w-xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-900/25"
              style={modalCardStyle}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <div className="modalContent flex-1 overflow-y-auto overscroll-contain px-6 py-7 sm:px-8 sm:py-9">
                <div className="flex h-full flex-col gap-6 text-center text-neutral-900">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-semibold sm:text-3xl">Still there?</h3>
                    <p className="text-base leading-relaxed text-neutral-600 sm:text-lg">{idleMessage}</p>
                  </div>
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <span className="text-6xl font-extrabold leading-none sm:text-7xl">{idleCountdown}</span>
                    <p className="text-sm text-neutral-500 sm:text-base">
                      Resetting in {idleCountdown} seconds…
                    </p>
                  </div>
                  <div className="mt-auto grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleIdleStay}
                      className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 px-4 py-3 text-base font-semibold text-neutral-800 transition hover:bg-neutral-50"
                    >
                      I’m still here
                    </button>
                    <button
                      type="button"
                      onClick={handleIdleTimeout}
                      className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-3 text-base font-semibold uppercase tracking-wide text-white shadow-lg shadow-rose-900/20 transition hover:bg-rose-700 active:translate-y-px"
                    >
                      Start over
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </KioskLayout>
  );
}
