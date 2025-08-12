// slides: restored
import React, { useEffect, useRef } from 'react';

export default function Slides({
  children,
  onHeroInView,
  onProgress,
}: {
  children: React.ReactNode;
  onHeroInView?: (v: boolean) => void;
  onProgress?: (p: number) => void; // 0..1 based on first slide scroll
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onHeroInView || !heroRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => onHeroInView(entry.isIntersecting),
      { root: rootRef.current ?? undefined, threshold: 0.95 }
    );
    obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, [onHeroInView]);

  // progress: 0 at top of hero, 1 at exactly one viewport scrolled
  useEffect(() => {
    if (!onProgress || !rootRef.current) return;
    const el = rootRef.current;
    const handler = () => {
      const h = el.clientHeight || 1;
      const p = Math.max(0, Math.min(1, el.scrollTop / h));
      onProgress(p);
    };
    handler();
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [onProgress]);

  return (
    <div
      ref={rootRef}
      style={{
        height: '100vh',
        overflowY: 'auto',
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Hero sentinel: the first child should be wrapped so we can observe it */}
      <div ref={heroRef} style={{ height: '100vh', scrollSnapAlign: 'start' }}>
        {Array.isArray(children) ? children[0] : children}
      </div>
      {/* Remaining slides */}
      {Array.isArray(children)
        ? children.slice(1).map((c, i) => (
            <div key={i} style={{ height: '100vh', scrollSnapAlign: 'start' }}>
              {c}
            </div>
          ))
        : null}
    </div>
  );
}
