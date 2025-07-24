import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Phone, MapPin, Clock } from 'lucide-react';
import TestimonialsSection from '../../components/TestimonialsSection';
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

export default function RestaurantHome() {
  const router = useRouter();
  const { restaurant_id } = router.query;
  const restaurantId = Array.isArray(restaurant_id) ? restaurant_id[0] : restaurant_id;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [todayHours, setTodayHours] = useState<OpeningHours | null>(null);
  const [loading, setLoading] = useState(true);
  const { cart } = useCart();
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  const fadeIn = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  useEffect(() => {
    if (!router.isReady || !restaurantId) return;

    const load = async () => {
      const { data: rest } = await supabase
        .from('restaurants')
        .select('id,name,logo_url,website_description,cover_image_url,contact_number,address,is_open,break_until')
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

  if (!router.isReady || loading) {
    return <div className="p-6 text-center">Loading...</div>;
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

  const breakUntilActive = restaurant.break_until && new Date(restaurant.break_until).getTime() > Date.now();
  const open = restaurant.is_open && isOpenNow() && !breakUntilActive;
  const breakResume = breakUntilActive
    ? new Date(restaurant.break_until!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const statusText = breakResume
    ? `On Break – Back at ${breakResume}`
    : open
    ? 'We’re open now!'
    : 'Sorry, we’re currently closed';

  const statusClasses = `px-4 py-1 rounded-full flex items-center gap-2 ${open ? 'bg-green-100 text-green-700 glow-green' : 'bg-red-100 text-red-700'}`;

  const mapsUrl = restaurant.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`
    : '#';


  return (
    <CustomerLayout cartCount={itemCount}>
      <div className="flex flex-col w-full">
        {/* Section 1: Fullscreen Hero */}
        <motion.section
          className="relative w-full h-screen flex items-end justify-start"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
        >
          {restaurant.cover_image_url && (
            <Image src={restaurant.cover_image_url} alt="Hero" fill className="object-cover object-center" />
          )}
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 p-6 text-white">
            {restaurant.logo_url && (
              <Image
                src={restaurant.logo_url}
                alt="Logo"
                width={64}
                height={64}
                className="rounded-full border border-white bg-white mb-4"
              />
            )}
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">{restaurant.name}</h1>
            {restaurant.website_description && (
              <p className="text-sm sm:text-base text-white/90">
                {restaurant.website_description}
              </p>
            )}
            <div className="mt-6">
              <Link href={`/restaurant/menu?restaurant_id=${restaurantId}`}>
                <button className="bg-white text-black rounded-full px-6 py-3 text-sm font-semibold shadow hover:scale-105 transition">
                  Order Now
                </button>
              </Link>
            </div>
          </div>
        </motion.section>

        {/* Section 2: Live Status */}
        <motion.section
          className="flex items-center justify-center py-6 bg-white min-h-[80vh] text-sm font-medium"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
        >
          <div className={statusClasses}>
            <Clock className="w-4 h-4" />
            {statusText}
          </div>
        </motion.section>

        {/* Section 3: Reviews */}
        <TestimonialsSection />

        {/* Section 4: CTA */}
        <motion.section
          className="bg-white px-4 py-10 space-y-4 min-h-[80vh] flex flex-col justify-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
        >
          {restaurant.contact_number && (
            <Link href={`tel:${restaurant.contact_number}`}>
              <button className="w-full border border-gray-300 rounded-full py-3 flex items-center justify-center gap-2">
                <Phone className="w-5 h-5" />
                Call Us
              </button>
            </Link>
          )}
          {restaurant.address && (
            <Link href={mapsUrl} target="_blank">
              <button className="w-full border border-gray-300 rounded-full py-3 flex items-center justify-center gap-2">
                <MapPin className="w-5 h-5" />
                Find Us
              </button>
            </Link>
          )}
        </motion.section>
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
