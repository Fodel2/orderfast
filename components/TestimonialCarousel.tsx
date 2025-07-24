import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

export default function TestimonialCarousel() {
  const testimonials = [
    { rating: 5, text: "🔥 The best burger I've had in years!", name: 'Jasmine' },
    { rating: 4, text: 'Quick delivery and amazing fries.', name: 'Luke' },
    { rating: 5, text: 'So good I came back the next day.', name: 'Aminah' },
    { rating: 4, text: 'Perfect hangover cure!', name: 'Ben' },
  ];

  const fadeIn = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <motion.section
      className="w-full min-h-screen bg-white px-4 py-16 flex flex-col justify-center items-center text-center"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={fadeIn}
    >
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">Testimonials</h2>
        <p className="text-sm sm:text-base text-gray-500 mb-8">
          See what our customers are saying about their experience with us.
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-2 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0">
        {testimonials.map((t, i) => (
          <div
            key={i}
            className="snap-center shrink-0 min-w-[250px] max-w-xs sm:min-w-0 bg-gray-50 p-6 rounded-xl shadow transition hover:shadow-md"
          >
            <div className="flex justify-center gap-1 text-yellow-500 mb-3">
              {Array.from({ length: t.rating }).map((_, j) => (
                <Star key={j} className="w-5 h-5 fill-yellow-500 stroke-yellow-500" data-testid="star" />
              ))}
            </div>
            <p className="text-sm text-gray-800 mb-2 italic">"{t.text}"</p>
            <p className="text-xs text-gray-500 text-right">— {t.name}</p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
