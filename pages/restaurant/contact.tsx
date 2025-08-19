import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import CustomerLayout from '@/components/CustomerLayout';
import { supabase } from '@/utils/supabaseClient';
import { useCart } from '@/context/CartContext';
import { BrandProvider } from '@/components/branding/BrandProvider';
import resolveRestaurantId from '@/lib/resolveRestaurantId';

export default function ContactPage() {
  const router = useRouter();
  const { cart } = useCart();
  const cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [settings, setSettings] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);
  const rid = resolveRestaurantId(router, null, restaurant);

  useEffect(() => {
    if (!router.isReady || !rid) return;
    supabase
      .from('restaurants')
      .select('*')
      .eq('id', rid)
      .maybeSingle()
      .then(({ data }) => setRestaurant(data));
    supabase
      .from('website_contact_settings')
      .select('*')
      .eq('restaurant_id', rid)
      .maybeSingle()
      .then(({ data }) => setSettings(data));
  }, [router.isReady, rid]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  if (!settings?.enabled) {
    return (
      <BrandProvider restaurant={restaurant}>
        <CustomerLayout cartCount={cartCount}>
          <div className="container mx-auto max-w-5xl px-4 py-8">
            <p>Contact form is disabled.</p>
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
          {sent ? (
            <p>{settings.success_message}</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {settings.fields?.name && (
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Name"
                  className="w-full border border-gray-300 rounded p-2"
                />
              )}
              {settings.fields?.phone && (
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone"
                  className="w-full border border-gray-300 rounded p-2"
                />
              )}
              {settings.fields?.message && (
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Message"
                  className="w-full border border-gray-300 rounded p-2"
                />
              )}
              <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded">
                Send
              </button>
            </form>
          )}
        </div>
      </CustomerLayout>
    </BrandProvider>
  );
}
