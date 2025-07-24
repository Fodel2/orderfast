import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';

export default function TestimonialCarousel() {
  const testimonials = [
    { rating: 5, text: "\ud83d\udd25 The best burger I've had in years!", name: 'Jasmine' },
    { rating: 4, text: 'Quick delivery and amazing fries.', name: 'Luke' },
    { rating: 5, text: 'So good I came back the next day.', name: 'Aminah' },
    { rating: 4, text: 'Perfect hangover cure!', name: 'Ben' },
  ];

  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir === 'left' ? -300 : 300,
      behavior: 'smooth',
    });
  };

  return (
    <section className="bg-white px-4 py-10">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">What our customers say</h2>
        <div className="hidden sm:flex gap-2">
          <button
            onClick={() => scroll('left')}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-1 px-1 touch-pan-x scrollbar-hide"
      >
        {testimonials.map((t, i) => (
          <div
            key={i}
            className="min-w-[250px] max-w-xs bg-gray-50 p-4 rounded-xl snap-center shrink-0 shadow-sm"
          >
            <div className="flex gap-1 text-yellow-500 mb-2">
              {Array.from({ length: t.rating }).map((_, j) => (
                <Star
                  key={j}
                  className="w-4 h-4 fill-yellow-500 stroke-yellow-500"
                  data-testid="star"
                />
              ))}
            </div>
            <p className="text-sm text-gray-700 mb-2">"{t.text}"</p>
            <p className="text-xs text-gray-500 text-right">\u2013 {t.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
