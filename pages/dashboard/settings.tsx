import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import PrinterSettingsTab from '../../components/dashboard/PrinterSettingsTab';
import {
  SettingsPlaceholder,
  SettingsSectionCard,
  SettingsShell,
} from '../../components/dashboard/settings/SettingsShell';
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
        <SettingsSectionCard
          title="General"
          description="Overview of your dashboard settings areas and reusable structure."
        >
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
        </SettingsSectionCard>
      );
    }

    if (activeSection === 'restaurant-details') {
      return (
        <SettingsPlaceholder
          title="Restaurant Details"
          description="Business profile, contact and identity details."
        />
      );
    }

    if (activeSection === 'opening-hours') {
      return (
        <SettingsPlaceholder
          title="Opening Hours"
          description="Daily service windows and temporary schedule controls."
        />
      );
    }

    return null;
  };

  if (loading) {
    return <DashboardLayout>Loading...</DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <SettingsShell
        title="Dashboard Settings"
        description="Manage your restaurant configuration and operations settings."
        sections={navItems}
        activeSection={activeSection}
        onSelectSection={(section) => openSection(section as SettingsSection)}
      >
        {renderSection()}
      </SettingsShell>
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </DashboardLayout>
  );
}
