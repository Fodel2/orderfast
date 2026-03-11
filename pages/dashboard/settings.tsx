import Link from 'next/link';
import DashboardLayout from '../../components/DashboardLayout';

type SettingsLink = {
  href: string;
  label: string;
  description: string;
  status?: string;
};

const settingsLinks: SettingsLink[] = [
  {
    href: '/dashboard/settings/general',
    label: 'General',
    description: 'Overview preferences and shared dashboard behavior settings.',
    status: 'Coming soon',
  },
  {
    href: '/dashboard/settings/restaurant-details',
    label: 'Restaurant Details',
    description: 'Business identity, contact details and profile settings.',
    status: 'Coming soon',
  },
  {
    href: '/dashboard/settings/opening-hours',
    label: 'Opening Hours',
    description: 'Service windows, schedule controls and temporary changes.',
    status: 'Coming soon',
  },
  {
    href: '/dashboard/settings/printing',
    label: 'Printing',
    description: 'Printers, tickets, alerts and diagnostics.',
  },
];

export default function DashboardSettingsLandingPage() {
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="mt-2 text-sm text-gray-600">Choose a settings area to manage your restaurant configuration.</p>
        </header>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settingsLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-xl border border-gray-200 p-4 hover:border-teal-300 hover:bg-teal-50/30 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">{item.label}</h2>
                  {item.status ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{item.status}</span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-gray-600">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
