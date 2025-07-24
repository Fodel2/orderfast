import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import { Star, Phone, MapPin, Clock } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { useCart } from '../../context/CartContext';
import CustomerLayout from '../../components/CustomerLayout';

const fadeIn = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

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

function TestimonialCarousel() {
  const testimonials = [
    { rating: 5, text: "🔥 The best burger I've had in years!", name: 'Jasmine' },
    { rating: 4, text: 'Quick delivery and amazing fries.', name: 'Luke' },
    { rating: 5, text: 'So good I came back the next day.', name: 'Aminah' },
    { rating: 4, text: 'Perfect hangover cure!', name: 'Ben' },
  ];

  return (
    <motion.div variants={stagger} className="bg-white px-4 py-16 text-center">
      <motion.div variants={fadeIn} className="max-w-2xl mx-auto mb-8">
        <motion.h2 className="text-2xl font-bold mb-2" variants={fadeIn}>
          Testimonials
        </motion.h2>
        <motion.p className="text-gray-500 text-sm sm:text-base" variants={fadeIn}>
          See what our customers are saying about their experience with us.
        </motion.p>
      </motion.div>

      <Swiper
        modules={[Autoplay, Pagination]}
        spaceBetween={16}
        slidesPerView={1}
        loop={true}
        autoplay={{ delay: 4000 }}
        pagination={{ clickable: true }}
        className="max-w-6xl mx-auto"
      >
        {testimonials.map((t, i) => (
          <SwiperSlide key={i}>
            <div className="bg-gray-50 rounded-xl shadow-sm p-6 mx-2 h-full flex flex-col justify-between">
              <div className="flex justify-center gap-1 text-yellow-500 mb-3">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-yellow-500 stroke-yellow-500" />
                ))}
              </div>
              <p className="text-sm text-gray-700 italic mb-2">"{t.text}"</p>
              <p className="text-xs text-gray-500 text-right">— {t.name}</p>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </motion.div>
  );
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
      <div className="h-screen overflow-y-scroll snap-y snap-mandatory overflow-x-hidden">
        {/* Section 1: Fullscreen Hero */}
        <motion.section
          className="relative min-h-screen snap-start flex items-end justify-start bg-white px-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
        >
          {restaurant.cover_image_url && (
            <Image src={restaurant.cover_image_url} alt="Hero" fill className="object-cover object-center" />
          )}
          <div className="absolute inset-0 bg-black/60" />
          <motion.div variants={stagger} className="relative z-10 p-6 text-white">
            {restaurant.logo_url && (
              <Image
                src={restaurant.logo_url}
                alt="Logo"
                width={64}
                height={64}
                className="rounded-full border border-white bg-white mb-4"
              />
            )}
            <motion.h1 className="text-3xl sm:text-4xl font-bold mb-2" variants={fadeIn}>
              {restaurant.name}
            </motion.h1>
            {restaurant.website_description && (
              <motion.p className="text-sm sm:text-base text-white/90" variants={fadeIn}>
                {restaurant.website_description}
              </motion.p>
            )}
            <div className="mt-6">
              <Link href={`/restaurant/menu?restaurant_id=${restaurantId}`}>
                <motion.button
                  variants={fadeIn}
                  className="bg-white text-black rounded-full px-6 py-3 text-sm font-semibold shadow hover:scale-105 transition"
                >
                  Order Now
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </motion.section>

        {/* Section 2: Live Status */}
        <motion.section
          className="min-h-screen snap-start flex items-center justify-center bg-white px-4 text-sm font-medium"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
        >
          <motion.div variants={stagger} className={statusClasses}>
            <motion.span variants={fadeIn} className="flex items-center">
              <Clock className="w-4 h-4" />
            </motion.span>
            <motion.span variants={fadeIn}>{statusText}</motion.span>
          </motion.div>
        </motion.section>

        {/* Section 3: Reviews */}
        <motion.section
          className="min-h-screen snap-start flex items-center justify-center bg-white px-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
        >
          <TestimonialCarousel />
        </motion.section>

        {/* Section 4: CTA */}
        <motion.section
          className="bg-white px-4 py-10 space-y-4 min-h-screen snap-start flex flex-col justify-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
        >
          <motion.div variants={stagger} className="space-y-4">
            {restaurant.contact_number && (
              <Link href={`tel:${restaurant.contact_number}`}>
                <motion.button
                  variants={fadeIn}
                  className="w-full border border-gray-300 rounded-full py-3 flex items-center justify-center gap-2"
                >
                  <Phone className="w-5 h-5" />
                  Call Us
                </motion.button>
              </Link>
            )}
            {restaurant.address && (
              <Link href={mapsUrl} target="_blank">
                <motion.button
                  variants={fadeIn}
                  className="w-full border border-gray-300 rounded-full py-3 flex items-center justify-center gap-2"
                >
                  <MapPin className="w-5 h-5" />
                  Find Us
                </motion.button>
              </Link>
            )}
          </motion.div>
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
