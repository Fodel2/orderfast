import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Clock3,
  CreditCard,
  Globe,
  Puzzle,
  Settings,
  Shield,
  Store,
  Printer,
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';

type SettingsLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  status?: string;
};

const settingsLinks: SettingsLink[] = [
  {
    href: '/dashboard/settings/general',
    label: 'General',
    description: 'Overview preferences and shared dashboard behavior settings.',
    icon: Settings,
    status: 'Coming soon',
  },
  {
    href: '/dashboard/settings/restaurant-details',
    label: 'Restaurant Details',
    description: 'Business identity, contact details and profile settings.',
    icon: Store,
    status: 'Coming soon',
  },
  {
    href: '/dashboard/settings/opening-hours',
    label: 'Opening Hours',
    description: 'Service windows, schedule controls and temporary changes.',
    icon: Clock3,
    status: 'Coming soon',
  },
  {
    href: '/dashboard/settings/printing',
    label: 'Printing',
    description: 'Printers, tickets, alerts and diagnostics.',
    icon: Printer,
  },
  {
    href: '/dashboard/settings/website',
    label: 'Website',
    description: 'Brand, domain and customer app presentation controls.',
    icon: Globe,
    status: 'Coming soon',
  },
  {
    href: '/dashboard/settings/payments',
    label: 'Payments',
    description: 'Stripe and Stripe Connect setup for payouts and acceptance.',
    icon: CreditCard,
    status: 'Coming soon',
  },
  {
    href: '/dashboard/settings/team-permissions',
    label: 'Team & Permissions',
    description: 'Role access, permissions and account management.',
    icon: Shield,
    status: 'Coming soon',
  },
  {
    href: '/dashboard/settings/integrations',
    label: 'Integrations',
    description: 'Connections for delivery, marketing and external tools.',
    icon: Puzzle,
    status: 'Coming soon',
  },
];

export default function DashboardSettingsLandingPage() {
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        <header>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="mt-2 text-sm text-gray-600">Choose a settings area to manage your restaurant configuration.</p>
        </header>

        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
            {settingsLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg border border-gray-200 p-3 sm:p-3.5 hover:border-teal-300 hover:bg-teal-50/30 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-1.5 text-gray-600">
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <h2 className="truncate text-sm sm:text-base font-semibold text-gray-900">{item.label}</h2>
                  </div>
                  {item.status ? (
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-medium text-slate-600">
                      {item.status}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs sm:text-sm leading-5 text-gray-600">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
