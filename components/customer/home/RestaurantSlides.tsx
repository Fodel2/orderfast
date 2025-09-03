import React, { useEffect, useRef, useState } from 'react';
import Slides from '../Slides';
import LandingHero from './LandingHero';
import PageRenderer, { Block } from '@/components/PageRenderer';
import { supabase } from '@/utils/supabaseClient';
import { trackSlideEvent } from '@/utils/analytics';

export type RestaurantSlide = {
  id: string;
  restaurant_id: string;
  type: 'hero' | 'menu_highlight' | 'gallery' | 'reviews' | 'about' | 'location_hours' | 'cta_banner' | 'custom_builder';
  title: string | null;
  subtitle: string | null;
  media_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  sort_order: number | null;
  config_json: any;
};

export default function RestaurantSlides({ restaurantId, restaurant, onHeroInView }: { restaurantId: string; restaurant: any | null; onHeroInView?: (v: boolean) => void }) {
  const [slides, setSlides] = useState<RestaurantSlide[]>([]);
  const slideRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!restaurantId) return;
    const now = new Date().toISOString();
    supabase
      .from('restaurant_slides')
      .select('id,restaurant_id,type,title,subtitle,media_url,cta_label,cta_href,sort_order,config_json')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .or(`visible_from.is.null,visible_from.lte.${now}`)
      .or(`visible_until.is.null,visible_until.gte.${now}`)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data }) => setSlides(data || []));
  }, [restaurantId]);

  useEffect(() => {
    if (slides.length === 0) return;
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            const id = e.target.getAttribute('data-id');
            const type = e.target.getAttribute('data-type');
            if (id && type) trackSlideEvent('slide_impression', { slide_id: id, slide_type: type });
          }
        });
      },
      { threshold: 0.6 }
    );
    Object.values(slideRefs.current).forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, [slides]);

  useEffect(() => {
    if (!('requestIdleCallback' in window)) return;
    (window as any).requestIdleCallback(() => {
      slides.forEach(s => {
        if (s.media_url) {
          const img = new Image();
          img.src = s.media_url;
        }
      });
    });
  }, [slides]);

  if (slides.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center p-4 gap-4">
        <p className="text-lg">Nothing here yet.</p>
        <a
          href={`/restaurant/menu?restaurant_id=${restaurantId}`}
          className="px-4 py-2 rounded bg-emerald-600 text-white"
        >
          View Menu
        </a>
      </div>
    );
  }

  function renderSlide(s: RestaurantSlide) {
    const trackClick = () => trackSlideEvent('slide_cta_click', { slide_id: s.id, slide_type: s.type, cta_href: s.cta_href });
    switch (s.type) {
      case 'hero':
        return (
          <LandingHero
            title={s.title || ''}
            subtitle={s.subtitle || undefined}
            imageUrl={s.media_url || undefined}
            ctaLabel={s.cta_label || undefined}
            ctaHref={s.cta_href || `/restaurant/menu?restaurant_id=${restaurantId}`}
            onCtaClick={trackClick}
          />
        );
      case 'menu_highlight':
        return (
          <section className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
            <h2 className="text-2xl font-bold">{s.title}</h2>
            {s.subtitle && <p className="max-w-prose">{s.subtitle}</p>}
            <a
              href={s.cta_href || `/restaurant/menu?restaurant_id=${restaurantId}`}
              onClick={trackClick}
              className="px-4 py-2 rounded bg-emerald-600 text-white"
            >
              {s.cta_label || 'View Menu'}
            </a>
          </section>
        );
      case 'gallery': {
        const imgs: string[] = s.config_json?.images || [];
        return (
          <section className="flex h-full flex-col justify-center overflow-hidden">
            <div className="flex gap-2 overflow-x-auto p-4">
              {imgs.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt={s.title || ''} className="h-60 w-auto object-cover" loading="lazy" />
              ))}
            </div>
          </section>
        );
      }
      case 'reviews': {
        const reviews: any[] = s.config_json?.reviews || [];
        return (
          <section className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
            <h2 className="text-2xl font-bold">{s.title || 'Reviews'}</h2>
            {reviews.length ? (
              <ul className="space-y-4 max-w-prose">
                {reviews.map((r, i) => (
                  <li key={i} className="text-sm">"{r.quote}" – {r.author}</li>
                ))}
              </ul>
            ) : (
              <p>{s.subtitle || 'No reviews yet.'}</p>
            )}
          </section>
        );
      }
      case 'about':
        return (
          <section className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
            {s.media_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.media_url} alt={s.title || ''} className="max-h-60 object-cover" loading="lazy" />
            )}
            <h2 className="text-2xl font-bold">{s.title}</h2>
            {s.subtitle && <p className="max-w-prose">{s.subtitle}</p>}
          </section>
        );
      case 'location_hours': {
        const address = restaurant?.address;
        return (
          <section className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
            <h2 className="text-2xl font-bold">{s.title || 'Find Us'}</h2>
            {address ? <p>{address}</p> : <p>Please check our contact page for details.</p>}
            <a
              href={s.cta_href || `/restaurant/contact?restaurant_id=${restaurantId}`}
              onClick={trackClick}
              className="px-4 py-2 rounded bg-emerald-600 text-white"
            >
              {s.cta_label || 'Contact Us'}
            </a>
          </section>
        );
      }
      case 'cta_banner':
        return (
          <section className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center bg-emerald-600 text-white">
            <h2 className="text-2xl font-bold">{s.title}</h2>
            {s.subtitle && <p className="max-w-prose">{s.subtitle}</p>}
            {s.cta_label && (
              <a
                href={s.cta_href || '#'}
                onClick={trackClick}
                className="px-4 py-2 rounded bg-white text-emerald-700"
              >
                {s.cta_label}
              </a>
            )}
          </section>
        );
      case 'custom_builder':
        return <CustomBuilder slideId={s.id} />;
      default:
        return null;
    }
  }

  return (
    <Slides onHeroInView={onHeroInView}>
      {slides.map(s => (
        <div
          key={s.id}
          data-id={s.id}
          data-type={s.type}
          ref={el => (slideRefs.current[s.id] = el)}
          style={{ height: '100dvh', scrollSnapAlign: 'start' }}
        >
          {renderSlide(s)}
        </div>
      ))}
    </Slides>
  );
}

function CustomBuilder({ slideId }: { slideId: string }) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  useEffect(() => {
    supabase
      .from('restaurant_slide_blocks')
      .select('id,block_type,content_json,sort_order')
      .eq('slide_id', slideId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        const mapped: Block[] = (data || []).map(b => ({
          id: b.id,
          type: b.block_type === 'two_column' ? 'two-col' : (b.block_type as any),
          ...(b.content_json || {}),
        }));
        setBlocks(mapped);
      });
  }, [slideId]);
  return (
    <section className="p-4 max-w-3xl mx-auto flex items-center justify-center h-full">
      <PageRenderer blocks={blocks} />
    </section>
  );
}
