import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Phone, MapPin, Star } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { useCart } from '../../context/CartContext';
import CustomerLayout from '../../components/CustomerLayout';

interface Restaurant {
  id: number;
  name: string;
  logo_url: string | null;
  website_description: string | null;
  cover_image_url: string | null;
  contact_number: string | null;
  address: string | null;
  is_open: boolean | null;
  break_until: string | null;
}

interface OpeningHours {
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export default function RestaurantPage() {
  const router = useRouter();
  const { restaurant_id } = router.query;
  const restaurantId = Array.isArray(restaurant_id)
    ? restaurant_id[0]
    : restaurant_id;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [todayHours, setTodayHours] = useState<OpeningHours | null>(null);
  const [loading, setLoading] = useState(true);
  const { cart } = useCart();
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  useEffect(() => {
    if (!router.isReady || !restaurantId) return;

    const load = async () => {
      const { data: rest } = await supabase
        .from('restaurants')
        .select(
          'id,name,logo_url,website_description,cover_image_url,contact_number,address,is_open,break_until'
        )
        .eq('id', restaurantId)
        .maybeSingle();
      setRestaurant(rest);

      const today = new Date().getDay();
      const { data: hours } = await supabase
        .from('opening_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('day_of_week', today)
        .maybeSingle();
      if (hours) {
        setTodayHours({
          open_time: hours.open_time,
          close_time: hours.close_time,
          is_closed: hours.is_closed,
        });
      }

      setLoading(false);
    };

    load();
  }, [router.isReady, restaurantId]);

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  if (!restaurantId) {
    return <div className="p-6 text-center">No restaurant specified</div>;
  }

  if (!restaurant) {
    return <div className="p-6 text-center">Restaurant not found</div>;
  }

  const isOpenNow = () => {
    if (!todayHours || todayHours.is_closed || !todayHours.open_time || !todayHours.close_time) return false;
    const now = new Date();
    const [oh, om] = todayHours.open_time.split(':').map(Number);
    const [ch, cm] = todayHours.close_time.split(':').map(Number);
    const openDate = new Date();
    openDate.setHours(oh, om, 0, 0);
    const closeDate = new Date();
    closeDate.setHours(ch, cm, 0, 0);
    return now >= openDate && now <= closeDate;
  };

  const getStatus = () => {
    if (restaurant.break_until && new Date(restaurant.break_until).getTime() > Date.now()) {
      const resume = new Date(restaurant.break_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return { text: `On Break – Back at ${resume}`, style: 'bg-yellow-100 text-yellow-800' };
    }
    if (restaurant.is_open && isOpenNow()) {
      return { text: 'Open Now', style: 'bg-green-100 text-green-800' };
    }
    return { text: 'Currently Closed', style: 'bg-red-100 text-red-800' };
  };

  const status = getStatus();
  const mapsUrl = restaurant.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`
    : '#';

  return (
    <CustomerLayout cartCount={itemCount}>
      <div className="flex flex-col">
        <div className="relative h-48 w-full">
          {restaurant.cover_image_url && (
            <Image src={restaurant.cover_image_url} alt="Hero" fill className="object-cover" />
          )}
          <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-4 text-white">
            {restaurant.logo_url && (
              <Image
                src={restaurant.logo_url}
                alt="Logo"
                width={40}
                height={40}
                className="mb-2 rounded"
              />
            )}
            <h1 className="text-2xl font-bold">{restaurant.name}</h1>
            {restaurant.website_description && <p className="text-sm">{restaurant.website_description}</p>}
          </div>
        </div>

        <div className={`text-center py-2 font-medium ${status.style}`}>{status.text}</div>

        <div className="grid grid-cols-3 gap-2 p-4">
          <Link
            href={`/restaurant/menu?restaurant_id=${restaurant.id}`}
            className="bg-black text-white rounded-md text-sm text-center py-2"
          >
            Order Now
          </Link>
          {restaurant.contact_number ? (
            <Link
              href={`tel:${restaurant.contact_number}`}
              className="bg-white border text-sm rounded-md text-center py-2 flex items-center justify-center gap-1"
            >
              <Phone className="w-4 h-4" /> Contact
            </Link>
          ) : (
            <span className="bg-gray-100 border text-sm rounded-md text-center py-2 flex items-center justify-center gap-1 text-gray-400">
              <Phone className="w-4 h-4" /> Contact
            </span>
          )}
          {restaurant.address ? (
            <Link
              href={mapsUrl}
              target="_blank"
              className="bg-white border text-sm rounded-md text-center py-2 flex items-center justify-center gap-1"
            >
              <MapPin className="w-4 h-4" /> Directions
            </Link>
          ) : (
            <span className="bg-gray-100 border text-sm rounded-md text-center py-2 flex items-center justify-center gap-1 text-gray-400">
              <MapPin className="w-4 h-4" /> Directions
            </span>
          )}
        </div>

        <div className="px-4 py-2">
          <h2 className="text-base font-semibold mb-2">What people are saying</h2>
          <div className="space-y-2">
            {[{ rating: 5, text: 'Amazing food!' }, { rating: 4, text: 'Fries are \uD83D\uDD25' }].map((r, i) => (
              <div key={i} className="bg-gray-100 rounded-md px-3 py-2 text-sm">
                <div className="flex items-center gap-1 text-yellow-500">
                  {Array.from({ length: r.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-yellow-500 stroke-yellow-500" />
                  ))}
                </div>
                <p className="mt-1 text-gray-700">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}

export async function getStaticProps() {
  return {
    props: {
      customerMode: true,
      cartCount: 0,
    },
  };
}
