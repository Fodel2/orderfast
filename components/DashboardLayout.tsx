import Link from 'next/link';
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  ReceiptPercentIcon,
  TruckIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { ReactNode, useState } from 'react';
import { useRouter } from 'next/router';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const nav = [
    { href: '/dashboard', label: 'Home', icon: HomeIcon },
    { href: '/dashboard/menu-builder', label: 'Menu', icon: ClipboardDocumentListIcon },
    { href: '#', label: 'Sales', icon: ReceiptPercentIcon },
    { href: '#', label: 'Orders', icon: TruckIcon },
  ];

  const router = useRouter();
  const [open, setOpen] = useState(false);

  const highlight = 'text-teal-600';

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Mobile sidebar overlay */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-white border-r shadow-sm flex flex-col py-6 transform transition-transform md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-6 text-2xl font-semibold mb-8 flex items-center justify-between">
          OrderFast
          <button
            className="md:hidden p-1 rounded hover:bg-gray-100"
            onClick={() => setOpen(false)}
            aria-label="Close sidebar"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {nav.map((n) => {
            const active = router.pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center space-x-3 px-4 py-2 rounded hover:bg-gray-50 focus:outline-none ${active ? 'bg-gray-50 ' + highlight : ''}`}
              >
                <n.icon className={`w-5 h-5 ${active ? highlight : 'text-gray-500'}`} />
                <span className={active ? highlight : ''}>{n.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-60 p-6">
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
