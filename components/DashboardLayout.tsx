import Link from 'next/link';
import { HomeIcon, ClipboardDocumentListIcon, ReceiptPercentIcon, TruckIcon } from '@heroicons/react/24/outline';
import { ReactNode } from 'react';

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

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-60 bg-gray-800 text-white fixed inset-y-0 left-0 flex flex-col py-6">
        <div className="px-6 text-2xl font-semibold mb-8">OrderFast</div>
        <nav className="flex-1 px-2 space-y-2">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center space-x-3 px-4 py-2 rounded hover:bg-gray-700">
              <n.icon className="w-5 h-5" />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 ml-60 p-6">{children}</main>
    </div>
  );
}
