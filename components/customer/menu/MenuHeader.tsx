import React, { useEffect, useState } from 'react';

type MenuHeaderProps = {
  title: string;
  imageUrl?: string; // header/hero image (optional)
  accentHex?: string | null; // optional brand accent for overlay
  focalX?: number | null;
  focalY?: number | null;
};

export default function MenuHeader({
  title,
  imageUrl,
  accentHex,
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

  const overlay =
    accentHex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accentHex)
      ? `linear-gradient(180deg, ${accentHex}22, ${accentHex}11, #00000022)`
      : 'linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.06), rgba(0,0,0,0.08))';
  return (
    <section
      aria-label="Restaurant header"
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
      <div className="absolute inset-0" style={{ backgroundImage: overlay }} />
      <div className="absolute bottom-4 left-4">
        <div className="px-3 py-1 rounded-md bg-white/70 backdrop-blur-sm shadow text-sm font-semibold">
          {title}
        </div>
      </div>
    </section>
  );
}

