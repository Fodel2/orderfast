import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import PrinterSettingsTab from '../../components/dashboard/PrinterSettingsTab';
import Toast from '../../components/Toast';
import { supabase } from '../../utils/supabaseClient';

export default function DashboardSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [canEditPrinterSettings, setCanEditPrinterSettings] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

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

  if (loading) {
    return <DashboardLayout>Loading...</DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="mt-2 text-sm text-gray-600">Manage your restaurant dashboard settings.</p>
        </div>

        {restaurantId ? (
          <PrinterSettingsTab
            restaurantId={restaurantId}
            canEdit={canEditPrinterSettings}
            onToast={setToastMessage}
          />
        ) : (
          <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-600">
            We could not find your restaurant settings right now.
          </div>
        )}
      </div>
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </DashboardLayout>
  );
}
