import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import PrinterSettingsTab from '../../components/dashboard/PrinterSettingsTab';
import Toast from '../../components/Toast';
import { supabase } from '../../utils/supabaseClient';

type SettingsSection = 'general' | 'restaurant-details' | 'opening-hours' | 'printer-settings';

type SettingsNavItem = {
  key: SettingsSection;
  label: string;
  description: string;
};

const navItems: SettingsNavItem[] = [
  {
    key: 'general',
    label: 'General',
    description: 'Overview of your dashboard settings areas.',
  },
  {
    key: 'restaurant-details',
    label: 'Restaurant Details',
    description: 'Business profile, contact and identity details.',
  },
  {
    key: 'opening-hours',
    label: 'Opening Hours',
    description: 'Daily service windows and temporary schedule controls.',
  },
  {
    key: 'printer-settings',
    label: 'Printer Settings',
    description: 'Printers, ticket rules, voice alerts and troubleshooting.',
  },
];

function isValidSection(value: string | string[] | undefined): value is SettingsSection {
  if (typeof value !== 'string') return false;
  return navItems.some((item) => item.key === value);
}

export default function DashboardSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [canEditPrinterSettings, setCanEditPrinterSettings] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  const activeSection: SettingsSection = isValidSection(router.query.section)
    ? router.query.section
    : 'general';

  const activeItem = useMemo(
    () => navItems.find((item) => item.key === activeSection) ?? navItems[0],
    [activeSection]
  );

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const { data: membership } = await supabase
        .from('restaurant_users')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (membership?.restaurant_id) {
        setRestaurantId(membership.restaurant_id);
        const roleValue = String((membership as any).role || (membership as any).user_role || '').toLowerCase();
        setCanEditPrinterSettings(roleValue !== 'staff');
      }

      setLoading(false);
    };

    load();
  }, [router]);

  const openSection = (nextSection: SettingsSection) => {
    router.push(
      {
        pathname: '/dashboard/settings',
        query: { section: nextSection },
      },
      undefined,
      { shallow: true }
    );
  };

  const renderSection = () => {
    if (!restaurantId) {
      return (
        <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-600">
          We could not find your restaurant settings right now.
        </div>
      );
    }

    if (activeSection === 'printer-settings') {
      return (
        <PrinterSettingsTab
          restaurantId={restaurantId}
          canEdit={canEditPrinterSettings}
          onToast={setToastMessage}
        />
      );
    }

    if (activeSection === 'general') {
      return (
        <section className="bg-white rounded-lg shadow p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Choose a settings area below. This structure is ready for future sections like kitchen, payments, delivery, website, branding, and staff permissions.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {navItems.filter((item) => item.key !== 'general').map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => openSection(item.key)}
                className="text-left rounded-lg border border-gray-200 p-4 hover:border-teal-300 hover:bg-teal-50/30 transition"
              >
                <p className="font-semibold text-gray-900">{item.label}</p>
                <p className="text-sm text-gray-600 mt-1">{item.description}</p>
              </button>
            ))}
          </div>
        </section>
      );
    }

    return (
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900">{activeItem.label}</h2>
        <p className="text-sm text-gray-600 mt-2">
          This section is ready. Detailed controls will be added here soon.
        </p>
      </section>
    );
  };

  if (loading) {
    return <DashboardLayout>Loading...</DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Settings</h1>
          <p className="mt-2 text-sm text-gray-600">Manage your restaurant configuration and operations settings.</p>
        </div>

        <div className="bg-white rounded-lg shadow p-2">
          <nav className="flex gap-2 overflow-x-auto" aria-label="Settings sections">
            {navItems.map((item) => {
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => openSection(item.key)}
                  className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition ${
                    active ? 'bg-teal-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {renderSection()}
      </div>
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </DashboardLayout>
  );
}
