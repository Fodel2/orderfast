import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
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
import FrostedGlassBox from '../../components/FrostedGlassBox';

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

/** Floating emojis with gentle up/down motion used as ambient background */
function FloatingIconLayer() {
  const icons = [
    { e: '🍔', className: 'top-8 left-6 text-3xl', dur: 10 },
    { e: '🍟', className: 'top-1/3 right-8 text-2xl', dur: 12 },
    { e: '🥤', className: 'bottom-12 left-1/4 text-3xl', dur: 14 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      {icons.map((ic, i) => (
        <motion.span
          key={i}
          className={`absolute ${ic.className}`}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: ic.dur, repeat: Infinity, ease: 'easeInOut' }}
        >
          {ic.e}
        </motion.span>
      ))}
    </div>
  );
}

/** Small wavy svg divider reused between snap sections */
function SectionDivider({ className = 'text-white' }: { className?: string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 overflow-hidden leading-none pointer-events-none">
      <svg
        className={`relative block w-full h-10 ${className}`}
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
      >
        <path
          d="M0 30c80 40 160-40 240 0s160-40 240 0 160-40 240 0 160-40 240 0 160-40 240 0 160-40 240 0v50H0Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

function TestimonialCarousel() {
  const testimonials = [
    { rating: 5, text: "🔥 The best burger I've had in years!", name: 'Jasmine' },
    { rating: 4, text: 'Quick delivery and amazing fries.', name: 'Luke' },
    { rating: 5, text: 'So good I came back the next day.', name: 'Aminah' },
    { rating: 4, text: 'Perfect hangover cure!', name: 'Ben' },
  ];

  return (
    <motion.div variants={stagger} className="relative bg-white px-4 py-16 text-center overflow-hidden">
      <motion.div
        className="absolute w-24 h-24 bg-purple-300/40 rounded-full blur-2xl -top-8 -left-8"
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-32 h-32 bg-yellow-200/40 rounded-full blur-2xl -bottom-10 right-10"
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
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
            <motion.div
              variants={fadeIn}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              animate={{ y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
              className="bg-gray-50/60 backdrop-blur-sm rounded-xl shadow-lg p-6 mx-2 h-full flex flex-col justify-between"
            >
              <div className="flex justify-center gap-1 text-yellow-500 mb-3">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star
                    key={j}
                    className="w-4 h-4 fill-yellow-500 stroke-yellow-500 transition hover:brightness-110"
                  />
                ))}
              </div>
              <p className="text-sm text-gray-700 italic mb-2">"{t.text}"</p>
              <p className="text-xs text-gray-500 text-right">— {t.name}</p>
            </motion.div>
          </SwiperSlide>
        ))}
      </Swiper>
    </motion.div>
  );
}

function MenuPreviewSection() {
  return (
    <section className="relative min-h-screen snap-start flex items-center justify-center bg-gradient-to-b from-yellow-50 to-white px-4">
      <FloatingIconLayer />
      <motion.div
        className="relative z-10 max-w-md text-center"
        variants={fadeIn}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <FrostedGlassBox>
          <motion.h2 variants={fadeIn} className="text-2xl font-bold mb-2">
            Menu Preview
          </motion.h2>
          <motion.p variants={fadeIn} className="text-gray-700">
            A sneak peek at our crowd favourites.
          </motion.p>
        </FrostedGlassBox>
      </motion.div>
      <SectionDivider className="text-yellow-50" />
    </section>
  );
}

function GallerySection() {
  return (
    <section className="relative min-h-screen snap-start flex items-center justify-center bg-gradient-to-b from-gray-100 to-white px-4">
      <motion.div
        className="relative z-10 max-w-md text-center"
        variants={fadeIn}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <FrostedGlassBox>
          <motion.h2 variants={fadeIn} className="text-2xl font-bold mb-2">
            Gallery
          </motion.h2>
          <motion.p variants={fadeIn} className="text-gray-700">
            Photos from our kitchen and events.
          </motion.p>
        </FrostedGlassBox>
      </motion.div>
      <SectionDivider className="text-gray-100" />
    </section>
  );
}

function MeetTheTeamSection() {
  return (
    <section className="relative min-h-screen snap-start flex items-center justify-center bg-gradient-to-b from-purple-50 to-white px-4">
      <motion.div
        className="relative z-10 max-w-md text-center"
        variants={fadeIn}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <FrostedGlassBox>
          <motion.h2 variants={fadeIn} className="text-2xl font-bold mb-2">
            Meet The Team
          </motion.h2>
          <motion.p variants={fadeIn} className="text-gray-700">
            Get to know the faces behind the food.
          </motion.p>
        </FrostedGlassBox>
      </motion.div>
      <SectionDivider className="text-purple-50" />
    </section>
  );
}

function LocationSection() {
  return (
    <section className="relative min-h-screen snap-start flex items-center justify-center bg-gradient-to-b from-green-50 to-white px-4">
      <motion.div
        className="relative z-10 max-w-md text-center"
        variants={fadeIn}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <FrostedGlassBox>
          <motion.h2 variants={fadeIn} className="text-2xl font-bold mb-2">
            Our Location
          </motion.h2>
          <motion.p variants={fadeIn} className="text-gray-700">
            Find us in the heart of the city.
          </motion.p>
        </FrostedGlassBox>
      </motion.div>
      <SectionDivider className="text-green-50" />
    </section>
  );
}

function DeliveryInfoSection() {
  return (
    <section className="relative min-h-screen snap-start flex items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
      <motion.div
        className="relative z-10 max-w-md text-center"
        variants={fadeIn}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <FrostedGlassBox>
          <motion.h2 variants={fadeIn} className="text-2xl font-bold mb-2">
            Delivery Info
          </motion.h2>
          <motion.p variants={fadeIn} className="text-gray-700">
            Learn about our delivery options and areas.
          </motion.p>
        </FrostedGlassBox>
      </motion.div>
      <SectionDivider className="text-blue-50" />
    </section>
  );
}

function AppDownloadSection() {
  return (
    <section className="relative min-h-screen snap-start flex items-center justify-center bg-gradient-to-b from-pink-50 to-white px-4">
      <motion.div
        className="relative z-10 max-w-md text-center"
        variants={fadeIn}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <FrostedGlassBox>
          <motion.h2 variants={fadeIn} className="text-2xl font-bold mb-2">
            Get Our App
          </motion.h2>
          <motion.p variants={fadeIn} className="text-gray-700">
            Download for the best ordering experience.
          </motion.p>
        </FrostedGlassBox>
      </motion.div>
      <SectionDivider className="text-pink-50" />
    </section>
  );
}

function ReservationsSection() {
  return (
    <section className="relative min-h-screen snap-start flex items-center justify-center bg-gradient-to-b from-indigo-50 to-white px-4">
      <motion.div
        className="relative z-10 max-w-md text-center"
        variants={fadeIn}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <FrostedGlassBox>
          <motion.h2 variants={fadeIn} className="text-2xl font-bold mb-2">
            Reservations
          </motion.h2>
          <motion.p variants={fadeIn} className="text-gray-700">
            Book your table in advance.
          </motion.p>
        </FrostedGlassBox>
      </motion.div>
      <SectionDivider className="text-indigo-50" />
    </section>
  );
}

function AnnouncementsSection() {
  return (
    <section className="relative min-h-screen snap-start flex items-center justify-center bg-gradient-to-b from-orange-50 to-white px-4">
      <motion.div
        className="relative z-10 max-w-md text-center"
        variants={fadeIn}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <FrostedGlassBox>
          <motion.h2 variants={fadeIn} className="text-2xl font-bold mb-2">
            Announcements
          </motion.h2>
          <motion.p variants={fadeIn} className="text-gray-700">
            Latest news and upcoming events.
          </motion.p>
        </FrostedGlassBox>
      </motion.div>
      <SectionDivider className="text-orange-50" />
    </section>
  );
}

function OrderNowSection() {
  return (
    <section className="relative min-h-screen snap-start flex items-center justify-center bg-gradient-to-b from-red-50 to-white px-4">
      <motion.div
        className="relative z-10 max-w-md text-center"
        variants={fadeIn}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <FrostedGlassBox>
          <motion.h2 variants={fadeIn} className="text-2xl font-bold mb-4">
            Ready to Order?
          </motion.h2>
          <Link href="#">
            <motion.button
              variants={fadeIn}
              whileHover={{ scale: 1.05 }}
              className="bg-red-500 text-white rounded-full px-6 py-3 shadow-md"
            >
              Order Now
            </motion.button>
          </Link>
        </FrostedGlassBox>
      </motion.div>
      <SectionDivider className="text-red-50" />
    </section>
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

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], [0, -120]);

  const showMenuPreview = true;
  const showGallery = true;
  const showMeetTheTeam = true;
  const showLocation = true;
  const showDeliveryInfo = true;
  const showAppDownload = true;
  const showReservations = true;
  const showAnnouncements = true;
  const showOrderNow = true;

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

  const statusClasses = `px-4 py-1 rounded-full flex items-center gap-2 shadow-md ${open ? 'bg-green-100 text-green-700 glow-green' : 'bg-red-100 text-red-700'}`;

  const mapsUrl = restaurant.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`
    : '#';


  return (
    <CustomerLayout cartCount={itemCount}>
      <div className="h-screen overflow-y-scroll snap-y snap-mandatory overflow-x-hidden">
        {/* Section 1: Fullscreen Hero */}
        <motion.section
          ref={heroRef}
          className="relative min-h-screen snap-start flex items-end justify-start text-white bg-purple-900 px-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
        >
          {restaurant.cover_image_url && (
            <motion.div style={{ y: bgY }} className="absolute inset-0 will-change-transform">
              <Image src={restaurant.cover_image_url} alt="Hero" fill className="object-cover object-center" />
            </motion.div>
          )}
          <FloatingIconLayer />
          <div className="absolute inset-0 bg-gradient-to-b from-purple-900/70 via-black/60 to-transparent" />
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={open ? { opacity: [1, 0.7, 1], y: 0 } : { opacity: 1, y: 0 }}
            transition={{ duration: open ? 2 : 0.6, ease: 'easeOut', repeat: open ? Infinity : 0 }}
            className={`absolute top-4 left-4 ${statusClasses} backdrop-blur-md shadow-lg`}
          >
            <Clock className="w-4 h-4" />
            <span>{statusText}</span>
          </motion.div>
          <FrostedGlassBox className="relative z-10 text-center text-white max-w-sm">
            <motion.div variants={stagger}>
              {restaurant.logo_url && (
                <motion.div variants={fadeIn} className="relative w-16 h-16 mb-4 mx-auto">
                  <Image src={restaurant.logo_url} alt="Logo" fill className="rounded-full border border-white bg-white p-1" />
                </motion.div>
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
                    whileHover={{ scale: 1.05, boxShadow: '0 0 8px rgba(255,255,255,0.6)' }}
                    className="bg-white text-black rounded-full px-6 py-3 text-sm font-semibold shadow-md transition"
                  >
                    Order Now
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </FrostedGlassBox>
          <SectionDivider className="text-white" />
        </motion.section>

        {/* Section 2: Live Status */}
        <motion.section
          className="relative min-h-screen snap-start flex items-center justify-center bg-gradient-to-b from-purple-50 to-white px-4 text-sm font-medium"
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
          <SectionDivider className="text-purple-50" />
        </motion.section>

        {/* Section 3: Reviews */}
        <motion.section
          className="relative min-h-screen snap-start flex items-center justify-center bg-gradient-to-b from-yellow-50 to-white px-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
        >
          <FloatingIconLayer />
          <TestimonialCarousel />
          <SectionDivider className="text-yellow-50" />
        </motion.section>

        {showMenuPreview && <MenuPreviewSection />}
        {showGallery && <GallerySection />}
        {showMeetTheTeam && <MeetTheTeamSection />}
        {showLocation && <LocationSection />}
        {showDeliveryInfo && <DeliveryInfoSection />}
        {showAppDownload && <AppDownloadSection />}
        {showReservations && <ReservationsSection />}
        {showAnnouncements && <AnnouncementsSection />}
        {showOrderNow && <OrderNowSection />}

        {/* Section 4: CTA */}
        <motion.section
          className="relative bg-gradient-to-b from-white via-purple-50 to-white px-4 py-10 space-y-4 min-h-screen snap-start flex flex-col justify-center"
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
                  whileHover={{ scale: 1.05, boxShadow: '0 0 8px rgba(0,0,0,0.3)' }}
                  className="w-full border border-gray-300 rounded-full py-3 flex items-center justify-center gap-2 hover:brightness-110 shadow-md transition"
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
                  whileHover={{ scale: 1.05, boxShadow: '0 0 8px rgba(0,0,0,0.3)' }}
                  className="w-full border border-gray-300 rounded-full py-3 flex items-center justify-center gap-2 hover:brightness-110 shadow-md transition"
                >
                  <MapPin className="w-5 h-5" />
                  Find Us
                </motion.button>
              </Link>
            )}
          </motion.div>
          <SectionDivider className="text-white" />
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
