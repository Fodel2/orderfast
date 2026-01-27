import Link from 'next/link';
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  MegaphoneIcon,
  TruckIcon,
  CpuChipIcon,
  DeviceTabletIcon,
  GlobeAltIcon,
  UserGroupIcon,
  ArrowsRightLeftIcon,
  ChartBarIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ComputerDesktopIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';
import PosLaunchModal from '@/components/PosLaunchModal';
import { POS_APK_DOWNLOAD_URL } from '@/utils/pos/constants';

type NavChild = {
  href: string;
  label: string;
};

type NavItem = {
  href?: string | null;
  label: string;
  icon: React.ComponentType<any>;
  onClick?: () => void;
  disabled?: boolean;
  children?: NavChild[];
  tooltip?: string;
  target?: string;
  rel?: string;
};

interface DashboardLayoutProps {
  children: ReactNode;
}

type RestaurantContext = {
  id: string;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [restaurant, setRestaurant] = useState<RestaurantContext | null>(null);
  const router = useRouter();
  const [showPosModal, setShowPosModal] = useState(false);
  const [rememberPosChoice, setRememberPosChoice] = useState(false);
  const [posPreferenceSaved, setPosPreferenceSaved] = useState(false);

  useEffect(() => {
    let active = true;

    const loadRestaurant = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const { data: membership, error: membershipError } = await supabase
          .from('restaurant_users')
          .select('restaurant_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (membershipError || !membership?.restaurant_id) return;

        const restaurantId = membership.restaurant_id;

        const { error: restaurantError } = await supabase
          .from('restaurants')
          .select('id')
          .eq('id', restaurantId)
          .maybeSingle();

        if (restaurantError && process.env.NODE_ENV !== 'production') {
          console.error('[dashboard-layout] failed to load restaurant details', restaurantError);
        }

        if (!active) return;
        setRestaurant({
          id: restaurantId,
        });
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[dashboard-layout] failed to load restaurant', err);
        }
      }
    };

    loadRestaurant();

    return () => {
      active = false;
    };
  }, []);

  const restaurantIdFromRoute = (router.query.restaurantId as string | undefined) || null;
  const activeRestaurantId = restaurantIdFromRoute || restaurant?.id || null;

  const kioskUrl = activeRestaurantId ? `/kiosk/${activeRestaurantId}` : null;
  const posUrl = activeRestaurantId ? `/pos/${activeRestaurantId}` : null;

  const kioskDisabled = !activeRestaurantId;
  const posDisabled = !activeRestaurantId;

  const posPreferenceKey = useMemo(
    () => (activeRestaurantId ? `pos_launch_preference_${activeRestaurantId}` : null),
    [activeRestaurantId]
  );

  useEffect(() => {
    if (!posPreferenceKey || typeof window === 'undefined') {
      setPosPreferenceSaved(false);
      return;
    }

    const stored = window.localStorage.getItem(posPreferenceKey);
    setPosPreferenceSaved(stored === 'pwa');
  }, [posPreferenceKey]);

  const handlePosLaunch = () => {
    if (!posUrl) return;
    if (rememberPosChoice && posPreferenceKey && typeof window !== 'undefined') {
      window.localStorage.setItem(posPreferenceKey, 'pwa');
      setPosPreferenceSaved(true);
    }
    setShowPosModal(false);
    setRememberPosChoice(false);
    router.push(posUrl).catch(() => undefined);
  };

  const handlePosEntryClick = () => {
    if (posDisabled || !posUrl) return;
    if (posPreferenceSaved) {
      router.push(posUrl).catch(() => undefined);
      return;
    }
    setShowPosModal(true);
  };

  const handlePosPreferenceReset = () => {
    if (posPreferenceKey && typeof window !== 'undefined') {
      window.localStorage.removeItem(posPreferenceKey);
    }
    setPosPreferenceSaved(false);
    setRememberPosChoice(false);
    setShowPosModal(true);
  };

  const nav: NavItem[] = [
    { href: '/dashboard', label: 'Home', icon: HomeIcon },
    { href: '/dashboard/orders', label: 'Orders', icon: TruckIcon },
    { href: '/dashboard/menu-builder', label: 'Menu', icon: ClipboardDocumentListIcon },
    { href: null, label: 'Promotions', icon: MegaphoneIcon },
    {
      label: 'Till / POS',
      icon: ComputerDesktopIcon,
      onClick: handlePosEntryClick,
      disabled: posDisabled,
      tooltip: 'Opens the POS launcher.',
    },
    { href: null, label: 'KOD', icon: CpuChipIcon },
    {
      label: 'Kiosk',
      icon: DeviceTabletIcon,
      href: kioskUrl,
      disabled: kioskDisabled || !kioskUrl,
      tooltip: 'Opens in fullscreen kiosk mode.',
    },
    {
      label: 'Website',
      icon: GlobeAltIcon,
      children: [
        { href: '/dashboard/website/settings', label: 'Settings' },
        { href: '/dashboard/website/preview', label: 'Preview' },
      ],
    },
    { href: null, label: 'Team', icon: UserGroupIcon },
    { href: null, label: 'Transactions', icon: ArrowsRightLeftIcon },
    { href: null, label: 'Sales', icon: ChartBarIcon },
    { href: null, label: 'Invoices', icon: DocumentTextIcon },
    { href: null, label: 'Settings', icon: Cog6ToothIcon },
  ];

  const [open, setOpen] = useState(false); // mobile open state
  const [collapsed, setCollapsed] = useState(false); // desktop collapse state
  const [dropdownOpen, setDropdownOpen] = useState<Record<string, boolean>>({});

  const highlight = 'text-teal-600';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar overlay */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity${open ? ' opacity-100' : ' opacity-0 pointer-events-none'}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r shadow-sm flex flex-col py-6 transform transition-transform md:translate-x-0 w-60 ${open ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-20' : 'md:w-60'}`}
      >
        <div className="px-4 mb-8 flex items-center justify-between">
          {!collapsed && <span className="text-2xl font-semibold">OrderFast</span>}
          <div className="flex items-center space-x-2">
            <button
              className="hidden md:block p-1 rounded hover:bg-gray-100"
              onClick={() => setCollapsed(!collapsed)}
              aria-label="Toggle sidebar"
            >
              {collapsed ? (
                <ChevronRightIcon className="w-5 h-5" />
              ) : (
                <ChevronLeftIcon className="w-5 h-5" />
              )}
            </button>
            <button
              className="md:hidden p-1 rounded hover:bg-gray-100"
              onClick={() => setOpen(false)}
              aria-label="Close sidebar"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {nav.map((n) => {
            const children = Array.isArray(n.children) ? n.children : [];
            const hasChildren = children.length > 0;
            const active =
              (!!n.href && router.pathname === n.href) ||
              (hasChildren && children.some((c) => router.pathname === c.href));
            const isButton = typeof n.onClick === 'function';
            const disabled = Boolean(n.disabled);
            const interactive = !disabled;
            const base = `flex items-center px-4 py-2 rounded focus:outline-none transition ${
              active ? 'bg-gray-50 border-l-4 border-teal-600' : ''
            } ${interactive ? 'hover:bg-gray-50' : 'cursor-not-allowed'}`;
            const labelColor = active
              ? highlight
              : disabled
              ? 'text-gray-400'
              : 'text-gray-700';
            const labelClass = `${labelColor} ${collapsed ? 'hidden' : 'ml-3'}`;
            const iconClass = `w-6 h-6 ${active ? highlight : disabled ? 'text-gray-300' : 'text-gray-400'}`;

            if (hasChildren) {
              const openDrop = dropdownOpen[n.label];
              return (
                <div key={n.label}>
                  <button
                    type="button"
                    onClick={() =>
                      setDropdownOpen((prev) => ({ ...prev, [n.label]: !openDrop }))
                    }
                    className={base}
                    aria-label={n.label}
                  >
                    <n.icon className={iconClass} aria-hidden="true" />
                    <span className={labelClass}>{n.label}</span>
                  </button>
                  {openDrop && !collapsed && (
                    <div className="mt-1 ml-8 space-y-1">
                      {children.map((c) => {
                        const childActive = router.pathname === c.href;
                        return (
                          <Link
                            key={c.label}
                            href={c.href}
                            className={`block px-4 py-2 rounded hover:bg-gray-50 ${
                              childActive ? 'bg-gray-50 border-l-4 border-teal-600' : ''
                            }`}
                          >
                            <span className={childActive ? highlight : 'text-gray-700'}>
                              {c.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isPosEntry = n.label === 'Till / POS';

            if (isButton && isPosEntry && posPreferenceSaved && !collapsed) {
              return (
                <div key={n.label} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={n.onClick}
                    disabled={disabled}
                    className={`${base} flex-1 ${interactive ? 'text-gray-700' : 'text-gray-400'}`}
                    aria-label={n.label}
                    title={n.tooltip}
                  >
                    <n.icon className={iconClass} aria-hidden="true" />
                    <span className={labelClass}>{n.label}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handlePosPreferenceReset();
                    }}
                    className="text-xs font-semibold text-teal-600 hover:underline"
                    aria-label="Change POS launch preference"
                  >
                    Change
                  </button>
                </div>
              );
            }

            if (isButton) {
              return (
                <button
                  key={n.label}
                  type="button"
                  onClick={n.onClick}
                  disabled={disabled}
                  className={`${base} ${interactive ? 'text-gray-700' : 'text-gray-400'}`}
                  aria-label={n.label}
                  title={n.tooltip}
                >
                  <n.icon className={iconClass} aria-hidden="true" />
                  <span className={labelClass}>{n.label}</span>
                </button>
              );
            }

            if (n.href) {
              if (disabled) {
                return (
                  <span
                    key={n.label}
                    className={`${base} text-gray-400 cursor-not-allowed`}
                    title={n.tooltip || 'Unavailable'}
                    aria-label={n.label}
                  >
                    <n.icon className="w-6 h-6 text-gray-400" aria-hidden="true" />
                    <span className={labelClass}>{n.label}</span>
                  </span>
                );
              }

              return (
                <Link
                  key={n.label}
                  href={n.href}
                  className={base}
                  aria-label={n.label}
                  title={n.tooltip}
                  target={n.target}
                  rel={n.rel}
                >
                  <n.icon className={iconClass} aria-hidden="true" />
                  <span className={labelClass}>{n.label}</span>
                </Link>
              );
            }

            return (
              <span
                key={n.label}
                className={`${base} text-gray-400 cursor-not-allowed`}
                title="Coming soon"
                aria-label={n.label}
              >
                <n.icon className="w-6 h-6 text-gray-400" aria-hidden="true" />
                <span className={labelClass}>{n.label}</span>
              </span>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className={`w-full flex-1 p-6 transition-all ${collapsed ? 'md:pl-20' : 'md:pl-60'}`}
      >
        {/* Mobile toggle button */}
        <button
          onClick={() => setOpen(true)}
          className="md:hidden mb-4 p-2 rounded border text-gray-600"
          aria-label="Open sidebar"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
        {children}
      </main>
      <PosLaunchModal
        open={showPosModal}
        rememberChoice={rememberPosChoice}
        onRememberChange={setRememberPosChoice}
        onLaunchPwa={handlePosLaunch}
        apkUrl={POS_APK_DOWNLOAD_URL}
        onClose={() => {
          setShowPosModal(false);
          setRememberPosChoice(false);
        }}
      />
    </div>
  );
}
