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
import { ReactNode, useState } from 'react';
import { useRouter } from 'next/router';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const nav = [
    { href: '/dashboard', label: 'Home', icon: HomeIcon },
    { href: '/dashboard/orders', label: 'Orders', icon: TruckIcon },
    { href: '/dashboard/menu-builder', label: 'Menu', icon: ClipboardDocumentListIcon },
    { href: null, label: 'Promotions', icon: MegaphoneIcon },
    { href: null, label: 'POS', icon: ComputerDesktopIcon },
    { href: null, label: 'KOD', icon: CpuChipIcon },
    { href: null, label: 'Kiosk', icon: DeviceTabletIcon },
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

  const router = useRouter();
  const [open, setOpen] = useState(false); // mobile open state
  const [collapsed, setCollapsed] = useState(false); // desktop collapse state
  const [dropdownOpen, setDropdownOpen] = useState<Record<string, boolean>>({});

  const highlight = 'text-teal-600';

  return (
    <div className="min-h-screen flex bg-gray-100">
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
            const hasChildren = Array.isArray(n.children);
            const active =
              (!!n.href && router.pathname === n.href) ||
              (hasChildren && n.children!.some((c) => router.pathname === c.href));
            const base = `flex items-center px-4 py-2 rounded hover:bg-gray-50 focus:outline-none ${active ? 'bg-gray-50 border-l-4 border-teal-600' : ''}`;
            const labelClass = `${active ? highlight : 'text-gray-700'} ${collapsed ? 'hidden' : 'ml-3'}`;
            const iconClass = `w-6 h-6 ${active ? highlight : 'text-gray-400'}`;

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
                      {n.children!.map((c) => {
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

            return n.href ? (
              <Link key={n.label} href={n.href} className={base} aria-label={n.label}>
                <n.icon className={iconClass} aria-hidden="true" />
                <span className={labelClass}>{n.label}</span>
              </Link>
            ) : (
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
      <main className={`flex-1 p-6 transition-all ${collapsed ? 'md:ml-20' : 'md:ml-60'}`}
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
    </div>
  );
}
