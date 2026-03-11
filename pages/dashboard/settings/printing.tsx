import { useEffect, useState } from 'react';
import { ChevronUpDownIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/DashboardLayout';
import PrinterSettingsTab, {
  PRINTING_SUB_TAB_ITEMS,
  type PrintingSubTab,
} from '../../../components/dashboard/PrinterSettingsTab';
import Toast from '../../../components/Toast';
import { supabase } from '../../../utils/supabaseClient';

const isValidPrintingSubTab = (value: string): value is PrintingSubTab =>
  PRINTING_SUB_TAB_ITEMS.some((item) => item.key === value);

export default function DashboardPrintingSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [canEditPrinterSettings, setCanEditPrinterSettings] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<PrintingSubTab>('printers');

  useEffect(() => {
    const querySection = String(router.query.section || '').toLowerCase();
    if (querySection && isValidPrintingSubTab(querySection)) {
      setActiveSubTab(querySection);
    }
  }, [router.query.section]);

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

  const setSection = (next: PrintingSubTab) => {
    setActiveSubTab(next);
    router.replace(
      {
        pathname: '/dashboard/settings/printing',
        query: { section: next },
      },
      undefined,
      { shallow: true }
    );
  };

  if (loading) return <DashboardLayout>Loading...</DashboardLayout>;

  if (!restaurantId) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto space-y-4">
          <Link href="/dashboard/settings" className="text-sm text-teal-700 hover:underline">
            ← Back to Settings
          </Link>
          <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-600">
            We could not find your restaurant settings right now.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="space-y-2">
          <Link href="/dashboard/settings" className="text-sm text-teal-700 hover:underline">
            ← Settings Home
          </Link>
          <h1 className="text-3xl font-bold">Printing Settings</h1>
          <p className="text-sm text-gray-600">Manage printers, ticket behavior, alerts and print diagnostics.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <div className="lg:hidden">
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-xl border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm font-medium text-gray-700 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  value={activeSubTab}
                  onChange={(e) => setSection(e.target.value as PrintingSubTab)}
                  aria-label="Printing section"
                >
                  {PRINTING_SUB_TAB_ITEMS.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronUpDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
              </div>
            </div>

            <nav className="hidden lg:flex lg:flex-col rounded-xl border border-gray-200 bg-white p-2" aria-label="Printing sections">
              {PRINTING_SUB_TAB_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSection(item.key)}
                  className={`text-left rounded-lg px-3 py-2 text-sm font-medium ${
                    activeSubTab === item.key ? 'bg-teal-600 text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          <div>
            <PrinterSettingsTab
              restaurantId={restaurantId}
              canEdit={canEditPrinterSettings}
              onToast={setToastMessage}
              activeSubTab={activeSubTab}
              onChangeSubTab={setSection}
              showInternalSubTabNav={false}
            />
          </div>
        </div>
      </div>
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </DashboardLayout>
  );
}
