import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/DashboardLayout';
import Toast from '../../../components/Toast';
import CustomPagesSection from '../../../components/CustomPagesSection';
import { SlidesDashboardList } from '../../../components/SlidesManager';
import SlideModal from '../../../components/SlideModal';
import type { SlideRow } from '../../../components/customer/home/SlidesContainer';
import { supabase } from '../../../utils/supabaseClient';

export default function WebsitePage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [subdomain, setSubdomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');

  const [autoAcceptKioskOrders, setAutoAcceptKioskOrders] = useState(false);
  const [autoAcceptAppOrders, setAutoAcceptAppOrders] = useState(false);
  const [autoAcceptPosOrders, setAutoAcceptPosOrders] = useState(false);
  const [expectedPrepMinutes, setExpectedPrepMinutes] = useState(10);
  const [busyPrepMinutes, setBusyPrepMinutes] = useState(12);
  const [backlogPrepMinutes, setBacklogPrepMinutes] = useState(18);
  const [busyOrderThreshold, setBusyOrderThreshold] = useState(6);
  const [backlogOrderThreshold, setBacklogOrderThreshold] = useState(10);

  const [contactEnabled, setContactEnabled] = useState(true);
  const [contactEmail, setContactEmail] = useState('');
  const [contactFields, setContactFields] = useState<{ name: boolean; phone: boolean; message: boolean }>({
    name: true,
    phone: false,
    message: true,
  });

  const [editingSlide, setEditingSlide] = useState<SlideRow | null>(null);
  const [refreshSlides, setRefreshSlides] = useState(0);

  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
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

      const { data: ru } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (ru?.restaurant_id) {
        setRestaurantId(ru.restaurant_id);
        const { data: rest } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', ru.restaurant_id)
          .single();

        if (rest) {
          setSubdomain(rest.subdomain || '');
          setCustomDomain(rest.custom_domain || '');
          setAutoAcceptKioskOrders(!!rest.auto_accept_kiosk_orders);
          setAutoAcceptAppOrders(!!rest.auto_accept_app_orders);
          setAutoAcceptPosOrders(!!rest.auto_accept_pos_orders);
          setExpectedPrepMinutes(Number(rest.expected_prep_minutes) || 10);
          setBusyPrepMinutes(Number(rest.busy_prep_minutes) || 12);
          setBacklogPrepMinutes(Number(rest.backlog_prep_minutes) || 18);
          setBusyOrderThreshold(Number(rest.busy_order_threshold) || 6);
          setBacklogOrderThreshold(Number(rest.backlog_order_threshold) || 10);
        }

        const { data: contact } = await supabase
          .from('website_contact_settings')
          .select('*')
          .eq('restaurant_id', ru.restaurant_id)
          .maybeSingle();

        if (contact) {
          setContactEnabled(contact.enabled);
          setContactEmail(contact.recipient_email || '');
          setContactFields(contact.fields || { name: true, phone: false, message: true });
        }
      }

      setLoading(false);
    };
    load();
  }, [router]);

  useEffect(() => {
    if (!subdomain) {
      setSubdomainAvailable(null);
      return;
    }

    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id')
        .eq('subdomain', subdomain)
        .maybeSingle();
      if (!error) {
        if (!data || data.id === restaurantId) {
          setSubdomainAvailable(true);
        } else {
          setSubdomainAvailable(false);
        }
      }
    }, 500);

    return () => clearTimeout(t);
  }, [subdomain, restaurantId]);

  function handleEditSlide(row: SlideRow) {
    setEditingSlide(row);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;

    if (subdomain && subdomainAvailable === false) {
      setToastMessage('Subdomain is not available');
      return;
    }

    const { error } = await supabase
      .from('restaurants')
      .update({
        subdomain,
        custom_domain: customDomain,
        auto_accept_kiosk_orders: autoAcceptKioskOrders,
        auto_accept_app_orders: autoAcceptAppOrders,
        auto_accept_pos_orders: autoAcceptPosOrders,
        expected_prep_minutes: expectedPrepMinutes,
        busy_prep_minutes: busyPrepMinutes,
        backlog_prep_minutes: backlogPrepMinutes,
        busy_order_threshold: busyOrderThreshold,
        backlog_order_threshold: backlogOrderThreshold,
      })
      .eq('id', restaurantId);

    const { error: contactErr } = await supabase
      .from('website_contact_settings')
      .upsert(
        {
          restaurant_id: restaurantId,
          enabled: contactEnabled,
          recipient_email: contactEmail,
          fields: contactFields,
        },
        { onConflict: 'restaurant_id' }
      );

    if (error || contactErr) {
      setToastMessage('Failed to save: ' + (error?.message || contactErr?.message));
    } else {
      setToastMessage('Website settings saved');
    }
  };

  if (loading) return <DashboardLayout>Loading...</DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Website Settings</h1>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
            Branding, business info, and website copy fields have moved to{' '}
            <span className="font-semibold">Settings → Restaurant Details</span>.
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block font-semibold">Subdomain</label>
              <input
                type="text"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded p-2"
              />
              {subdomain && subdomainAvailable === false && (
                <p className="text-red-600 text-sm mt-1">Not available</p>
              )}
              {subdomain && subdomainAvailable === true && (
                <p className="text-green-600 text-sm mt-1">Available</p>
              )}
            </div>

            <div>
              <label className="block font-semibold">Custom Domain</label>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded p-2"
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <h2 className="text-xl font-semibold mb-2">Order Handling</h2>
              <p className="text-sm text-gray-600 mb-3">
                Configure how new orders are treated when they arrive.
              </p>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={autoAcceptKioskOrders}
                    onChange={(e) => setAutoAcceptKioskOrders(e.target.checked)}
                  />
                  <span className="font-medium">Auto-accept kiosk orders</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={autoAcceptAppOrders}
                    onChange={(e) => setAutoAcceptAppOrders(e.target.checked)}
                  />
                  <span className="font-medium">Auto-accept app orders</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={autoAcceptPosOrders}
                    onChange={(e) => setAutoAcceptPosOrders(e.target.checked)}
                  />
                  <span className="font-medium">Auto-accept POS orders</span>
                </label>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h2 className="text-xl font-semibold mb-2">Kitchen &amp; Service</h2>
              <p className="text-sm text-gray-600 mb-3">
                These values control the Service Health indicator on the dashboard.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold">Expected prep minutes</label>
                  <input
                    type="number"
                    min={1}
                    value={expectedPrepMinutes}
                    onChange={(e) => setExpectedPrepMinutes(Number(e.target.value) || 10)}
                    className="mt-1 w-full border border-gray-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold">Busy prep minutes</label>
                  <input
                    type="number"
                    min={1}
                    value={busyPrepMinutes}
                    onChange={(e) => setBusyPrepMinutes(Number(e.target.value) || 12)}
                    className="mt-1 w-full border border-gray-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold">Backlog prep minutes</label>
                  <input
                    type="number"
                    min={1}
                    value={backlogPrepMinutes}
                    onChange={(e) => setBacklogPrepMinutes(Number(e.target.value) || 18)}
                    className="mt-1 w-full border border-gray-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold">Busy order threshold</label>
                  <input
                    type="number"
                    min={1}
                    value={busyOrderThreshold}
                    onChange={(e) => setBusyOrderThreshold(Number(e.target.value) || 6)}
                    className="mt-1 w-full border border-gray-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold">Backlog order threshold</label>
                  <input
                    type="number"
                    min={1}
                    value={backlogOrderThreshold}
                    onChange={(e) => setBacklogOrderThreshold(Number(e.target.value) || 10)}
                    className="mt-1 w-full border border-gray-300 rounded p-2"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h2 className="text-xl font-semibold mb-2">Contact Form</h2>
              <label className="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  checked={contactEnabled}
                  onChange={(e) => setContactEnabled(e.target.checked)}
                />
                <span>Enable contact form</span>
              </label>
              {contactEnabled && (
                <div className="space-y-2">
                  <div>
                    <label className="block font-semibold">Recipient Email</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded p-2"
                    />
                  </div>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={contactFields.name}
                        onChange={(e) => setContactFields({ ...contactFields, name: e.target.checked })}
                      />
                      <span>Name</span>
                    </label>
                    <label className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={contactFields.phone}
                        onChange={(e) => setContactFields({ ...contactFields, phone: e.target.checked })}
                      />
                      <span>Phone</span>
                    </label>
                    <label className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={contactFields.message}
                        onChange={(e) => setContactFields({ ...contactFields, message: e.target.checked })}
                      />
                      <span>Message</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="text-right">
              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>

      {restaurantId && (
        <>
          <SlidesDashboardList restaurantId={restaurantId} onEdit={handleEditSlide} refreshKey={refreshSlides} />
          {editingSlide && (
            <SlideModal
              slide={editingSlide}
              initialCfg={editingSlide.config_json}
              onClose={() => setEditingSlide(null)}
              onSave={async (newCfg) => {
                if (!restaurantId || !editingSlide?.id) return;
                await supabase
                  .from('restaurant_slides')
                  .update({ config_json: newCfg })
                  .eq('id', editingSlide.id)
                  .eq('restaurant_id', restaurantId);
                setEditingSlide(null);
                setRefreshSlides((k) => k + 1);
              }}
            />
          )}
        </>
      )}

      {restaurantId && <CustomPagesSection restaurantId={restaurantId} />}
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </DashboardLayout>
  );
}
