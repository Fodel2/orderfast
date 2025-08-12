import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import OpenBadge from './OpenBadge';

interface Props {
  restaurant: any;
  onVisibilityChange?: (inView: boolean) => void;
}

export default function Hero({ restaurant, onVisibilityChange }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!ref.current || !onVisibilityChange) return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      onVisibilityChange(entry.isIntersecting);
    }, { threshold: 0.1 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [onVisibilityChange]);

  const bg = restaurant?.cover_image_url || 'https://source.unsplash.com/1600x900/?food';
  const params = new URLSearchParams(router.query as any);
  if (restaurant?.id) params.set('restaurant_id', restaurant.id);
  const orderHref = `/restaurant/menu?${params.toString()}`;
  return (
    <section ref={ref} className="relative h-full w-full flex items-center justify-center text-center text-white">
      <Image src={bg} alt="hero" fill className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/70" />
      <div className="relative z-10 flex flex-col items-center gap-4 px-4">
        {/* slides: hero — logo provided by CollapsingHeader (single element) */}
        <h1 className="text-4xl font-light">{restaurant?.name}</h1>
        {restaurant?.website_description && (
          <p className="max-w-md text-white/90">{restaurant.website_description}</p>
        )}
        {typeof restaurant?.is_open === 'boolean' && <OpenBadge isOpen={restaurant.is_open} />}
        <Link href={orderHref} className="btn-primary">
          Order Now
        </Link>
      </div>
    </section>
  );
}
