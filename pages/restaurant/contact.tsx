import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
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
          {addressLines.length > 0 ? (
            <address className="mb-4 not-italic text-sm leading-6 text-gray-600">
              {addressLines.map((line, index) => (
                <div key={`${line}-${index}`}>{line}</div>
              ))}
            </address>
          ) : null}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Contact form is not live yet on this page. Please use the restaurant phone number or recipient email shared in current customer communications.
          </div>
        </div>
      </CustomerLayout>
    </BrandProvider>
  );
}
