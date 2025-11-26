import React, { useEffect, useState } from 'react';

type MenuHeaderProps = {
  title: string;
  imageUrl?: string; // header/hero image (optional)
  focalX?: number | null;
  focalY?: number | null;
};

export default function MenuHeader({
  title,
  imageUrl,
  focalX,
  focalY,
}: MenuHeaderProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setCollapsed(window.scrollY > 48);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <section
      aria-label={title || 'Restaurant header'}
      className={[
        'relative w-full overflow-hidden',
        'transition-all duration-500 ease-out will-change-transform will-change-opacity',
        collapsed ? 'h-20 md:h-24' : 'h-48 md:h-80',
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
      ].join(' ')}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            objectPosition: `${((focalX ?? 0.5) * 100).toFixed(2)}% ${((focalY ?? 0.5) * 100).toFixed(2)}%`,
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-black/15 pointer-events-none" />
    </section>
  );
}

