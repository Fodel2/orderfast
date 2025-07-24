import Image from 'next/image';
import Link from 'next/link';
import { Phone, MapPin, Clock, Star } from 'lucide-react';
import CustomerLayout from '../../components/CustomerLayout';

export default function RestaurantHome() {
  const restaurant = {
    name: 'Burger Bros',
    tagline: 'Smash burgers. Loaded fries. No compromise.',
    logoUrl: '/logo.png',
    heroImageUrl: '/hero.jpg',
    isOpen: true,
    phone: '01234 567890',
    googleMapsUrl: 'https://maps.google.com?q=Burger+Bros',
    reviews: [
      { rating: 5, text: "🔥 The best burger I've had in years!" },
      { rating: 4, text: 'Quick delivery and amazing fries.' },
    ],
  };

  return (
    <CustomerLayout cartCount={0}>
      <div className="flex flex-col w-full">
        {/* Section 1: Fullscreen Hero */}
        <section className="relative w-full h-screen flex items-end justify-start">
          <Image
            src={restaurant.heroImageUrl}
            alt="Hero"
            fill
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 p-6 text-white">
            <Image
              src={restaurant.logoUrl}
              alt="Logo"
              width={64}
              height={64}
              className="rounded-full border border-white bg-white mb-4"
            />
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 animate-fade-in-down">
              {restaurant.name}
            </h1>
            <p className="text-sm sm:text-base text-white/90 animate-fade-in-up">
              {restaurant.tagline}
            </p>
            <div className="mt-6">
              <Link href="/restaurant/menu">
                <button className="bg-white text-black rounded-full px-6 py-3 text-sm font-semibold shadow hover:scale-105 transition">
                  Order Now
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* Section 2: Live Status */}
        <section className="flex items-center justify-center py-3 bg-white text-sm font-medium">
          <div
            className={`px-4 py-1 rounded-full flex items-center gap-2 ${
              restaurant.isOpen ? 'bg-green-100 text-green-700 glow-green' : 'bg-red-100 text-red-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            {restaurant.isOpen ? 'We\u2019re open now!' : 'Sorry, we\u2019re currently closed'}
          </div>
        </section>

        {/* Section 3: Reviews */}
        <section className="bg-gray-50 px-4 py-6">
          <h2 className="text-lg font-semibold mb-4">What customers say</h2>
          <div className="space-y-3">
            {restaurant.reviews.map((review, i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex gap-1 text-yellow-500 mb-1">
                  {Array.from({ length: review.rating }).map((_, idx) => (
                    <Star key={idx} className="w-4 h-4 fill-yellow-500 stroke-yellow-500" />
                  ))}
                </div>
                <p className="text-sm text-gray-700">{review.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: CTA */}
        <section className="bg-white px-4 py-6 space-y-3">
          <Link href={`tel:${restaurant.phone}`}>
            <button className="w-full border border-gray-300 rounded-full py-3 flex items-center justify-center gap-2">
              <Phone className="w-5 h-5" />
              Call Us
            </button>
          </Link>
          <Link href={restaurant.googleMapsUrl} target="_blank">
            <button className="w-full border border-gray-300 rounded-full py-3 flex items-center justify-center gap-2">
              <MapPin className="w-5 h-5" />
              Find Us
            </button>
          </Link>
        </section>
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

