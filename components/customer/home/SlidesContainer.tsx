import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import PageRenderer from '@/components/PageRenderer';
import resolveRestaurantId from '@/lib/resolveRestaurantId';
import { supabase } from '@/lib/supabaseClient';

interface SlideRow {
  id: string;
  restaurant_id: string;
  type: string;
  title?: string | null;
  subtitle?: string | null;
  media_url?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  visible_from?: string | null;
  visible_until?: string | null;
  is_active: boolean;
  sort_order: number;
  config_json?: any;
}

export default function SlidesContainer() {
  const router = useRouter();
  const restaurantId = resolveRestaurantId(router, null);
  const [slides, setSlides] = useState<SlideRow[]>([]);

  useEffect(() => {
    if (!restaurantId) return;
    supabase
      .from('restaurant_slides')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .or('visible_from.is.null,visible_from.lte.now()')
      .or('visible_until.is.null,visible_until.gte.now()')
      .neq('type', 'hero')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data }) => setSlides(data || []));
  }, [restaurantId]);

  if (!slides.length) return null;

  return (
    <div>
      {slides.map((s) => (
        <SlideRenderer key={s.id} slide={s} restaurantId={restaurantId!} router={router} />
      ))}
    </div>
  );
}

function SlideRenderer({ slide, restaurantId, router }: { slide: SlideRow; restaurantId: string; router: any }) {
  const cfg = slide.config_json || {};

  switch (slide.type) {
    case 'menu_highlight': {
      const href = slide.cta_href || `/restaurant/menu?restaurant_id=${restaurantId}`;
      return (
        <section className="p-4 text-center">
          {slide.title && <h2 className="text-xl font-bold">{slide.title}</h2>}
          {slide.subtitle && <p className="mb-3">{slide.subtitle}</p>}
          <Button onClick={() => router.push(href)}>{slide.cta_label || 'View Menu'}</Button>
        </section>
      );
    }
    case 'gallery': {
      const images: string[] = Array.isArray(cfg.images) ? cfg.images : [];
      if (!images.length) return null;
      return (
        <div className="flex gap-2 overflow-x-auto p-4">
          {images.map((src, i) => (
            <Image key={i} src={src} alt="" width={200} height={150} />
          ))}
        </div>
      );
    }
    case 'reviews': {
      const quotes: { text: string; author?: string }[] = Array.isArray(cfg.quotes)
        ? cfg.quotes
        : [];
      return (
        <section className="p-4 text-center">
          {slide.title && <h2 className="text-xl font-bold">{slide.title}</h2>}
          {slide.subtitle && <p className="mb-4">{slide.subtitle}</p>}
          {quotes.slice(0, 2).map((q, i) => (
            <blockquote key={i} className="mb-2">
              <p>“{q.text}”</p>
              {q.author && <cite className="block text-sm">- {q.author}</cite>}
            </blockquote>
          ))}
        </section>
      );
    }
    case 'about': {
      return (
        <section className="p-4 text-center">
          {slide.title && <h2 className="text-xl font-bold">{slide.title}</h2>}
          {slide.subtitle && <p className="mb-3">{slide.subtitle}</p>}
          {slide.media_url && (
            <Image src={slide.media_url} alt="" width={400} height={300} />
          )}
        </section>
      );
    }
    case 'location_hours': {
      const href = slide.cta_href || `/restaurant/p/contact?restaurant_id=${restaurantId}`;
      return (
        <section className="p-4 text-center">
          {slide.title && <h2 className="text-xl font-bold">{slide.title}</h2>}
          {slide.subtitle && <p className="mb-3">{slide.subtitle}</p>}
          <Button onClick={() => router.push(href)}>{slide.cta_label || 'Get Directions'}</Button>
        </section>
      );
    }
    case 'cta_banner': {
      return (
        <section className="p-4 text-center">
          {slide.title && <h2 className="text-xl font-bold">{slide.title}</h2>}
          {slide.subtitle && <p className="mb-3 font-semibold">{slide.subtitle}</p>}
          {slide.cta_href && (
            <Button onClick={() => router.push(slide.cta_href!)}>{slide.cta_label || 'Learn More'}</Button>
          )}
        </section>
      );
    }
    case 'custom_builder':
      return <CustomBuilderSlide slide={slide} restaurantId={restaurantId} />;
    default:
      return null;
  }
}

function CustomBuilderSlide({ slide, restaurantId }: { slide: SlideRow; restaurantId: string }) {
  const [blocks, setBlocks] = useState<any[]>([]);
  useEffect(() => {
    supabase
      .from('restaurant_slide_blocks')
      .select('content_json')
      .eq('slide_id', slide.id)
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => setBlocks(data?.map((b: any) => b.content_json) || []));
  }, [slide.id, restaurantId]);

  if (!blocks.length) {
    return (
      <section className="p-4 text-center">
        {slide.title && <h2 className="text-xl font-bold">{slide.title}</h2>}
        {slide.subtitle && <p className="mb-3">{slide.subtitle}</p>}
        {/* TODO: render custom blocks */}
      </section>
    );
  }
  return (
    <section className="p-4">
      {slide.title && <h2 className="text-xl font-bold text-center">{slide.title}</h2>}
      {slide.subtitle && <p className="mb-3 text-center">{slide.subtitle}</p>}
      <PageRenderer blocks={blocks as any} />
    </section>
  );
}

