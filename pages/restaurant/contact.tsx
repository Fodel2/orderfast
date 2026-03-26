import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import CustomerLayout from '@/components/CustomerLayout';
import { supabase } from '@/utils/supabaseClient';
import { useCart } from '@/context/CartContext';
import { BrandProvider } from '@/components/branding/BrandProvider';
import resolveRestaurantId from '@/lib/resolveRestaurantId';

type ContactSettings = {
  enabled: boolean;
  recipient_email: string | null;
  success_message: string | null;
  fields: {
    name?: boolean;
    phone?: boolean;
    email?: boolean;
    message?: boolean;
  } | null;
};

export default function ContactPage() {
  const router = useRouter();
  const { cart } = useCart();
  const cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [settings, setSettings] = useState<ContactSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const rid = resolveRestaurantId(router, null, restaurant);
  const addressLines = useMemo(() => {
    const structured = [
      String(restaurant?.address_line_1 || '').trim(),
      String(restaurant?.address_line_2 || '').trim(),
      [String(restaurant?.city || '').trim(), String(restaurant?.county_state || '').trim(), String(restaurant?.postcode || '').trim()]
        .filter(Boolean)
        .join(', '),
      String(restaurant?.country_code || '').trim(),
    ].filter(Boolean);

    if (structured.length > 0) return structured;

    const raw = String(restaurant?.address || '').trim();
    if (!raw) return [];
    return raw
      .split(/\r?\n|,\s*/g)
      .map((line) => line.trim())
      .filter(Boolean);
  }, [restaurant?.address, restaurant?.address_line_1, restaurant?.address_line_2, restaurant?.city, restaurant?.county_state, restaurant?.postcode, restaurant?.country_code]);

  useEffect(() => {
    if (!router.isReady || !rid) return;
    const loadPage = async () => {
      setLoading(true);
      const [{ data: restaurantData }, { data: settingsData }] = await Promise.all([
        supabase.from('restaurants').select('*').eq('id', rid).maybeSingle(),
        supabase.from('website_contact_settings').select('*').eq('restaurant_id', rid).maybeSingle(),
      ]);
      setRestaurant(restaurantData);
      setSettings((settingsData as ContactSettings | null) || null);
      setLoading(false);
    };
    loadPage();
  }, [router.isReady, rid]);

  const contactFields = {
    name: !!settings?.fields?.name,
    phone: !!settings?.fields?.phone,
    email: !!settings?.fields?.email,
    message: true,
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rid || !settings?.enabled) return;
    if (!message.trim()) {
      setSubmitError('Please enter your message.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');

    const payload = {
      restaurant_id: rid,
      name: contactFields.name ? name.trim() || null : null,
      phone: contactFields.phone ? phone.trim() || null : null,
      email: contactFields.email ? email.trim() || null : null,
      message: message.trim(),
      status: 'new',
    };

    const { error } = await supabase.from('contact_messages').insert(payload);
    if (error) {
      setSubmitError(error.message || 'Unable to send your message right now.');
      setSubmitting(false);
      return;
    }

    setSubmitSuccess(settings.success_message || 'Thanks — we’ll get back to you shortly!');
    setName('');
    setPhone('');
    setEmail('');
    setMessage('');
    setSubmitting(false);
  };

  if (loading) {
    return (
      <BrandProvider restaurant={restaurant}>
        <CustomerLayout cartCount={cartCount}>
          <div className="container mx-auto max-w-5xl px-4 py-8">
            <div className="h-10 w-48 animate-pulse rounded bg-gray-100" />
          </div>
        </CustomerLayout>
      </BrandProvider>
    );
  }

  if (!settings?.enabled) {
    return (
      <BrandProvider restaurant={restaurant}>
        <CustomerLayout cartCount={cartCount}>
          <div className="container mx-auto max-w-5xl px-4 py-8">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
              <h1 className="text-2xl font-semibold text-gray-900">Contact unavailable</h1>
              <p className="mt-2 text-sm text-gray-600">
                This restaurant has contact messages turned off right now.
              </p>
            </div>
          </div>
        </CustomerLayout>
      </BrandProvider>
    );
  }

  return (
    <BrandProvider restaurant={restaurant}>
      <CustomerLayout cartCount={cartCount}>
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <h1 className="text-3xl font-bold mb-4">Contact</h1>
          {addressLines.length > 0 ? (
            <address className="mb-4 not-italic text-sm leading-6 text-gray-600">
              {addressLines.map((line, index) => (
                <div key={`${line}-${index}`}>{line}</div>
              ))}
            </address>
          ) : null}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <form className="space-y-4" onSubmit={handleSubmit}>
              {contactFields.name && (
                <div>
                  <label htmlFor="contact-name" className="mb-1 block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    autoComplete="name"
                  />
                </div>
              )}

              {contactFields.phone && (
                <div>
                  <label htmlFor="contact-phone" className="mb-1 block text-sm font-medium text-gray-700">
                    Phone
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    autoComplete="tel"
                  />
                </div>
              )}

              {contactFields.email && (
                <div>
                  <label htmlFor="contact-email" className="mb-1 block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    autoComplete="email"
                  />
                </div>
              )}

              <div>
                <label htmlFor="contact-message" className="mb-1 block text-sm font-medium text-gray-700">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="contact-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="min-h-[140px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  required
                />
              </div>

              {submitError && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {submitError}
                </p>
              )}
              {submitSuccess && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {submitSuccess}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                  {settings?.recipient_email ? `Messages go to: ${settings.recipient_email}` : 'Messages are sent directly to the restaurant team.'}
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </CustomerLayout>
    </BrandProvider>
  );
}
