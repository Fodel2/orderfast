import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import resolveRestaurantId from '@/lib/resolveRestaurantId';
import { supabase } from '@/lib/supabaseClient';
import type { SlideConfig } from '@/components/SlideModal';

export interface SlideRow {
  id?: string;
  restaurant_id: string;
  type: string;
  title?: string | null;
  subtitle?: string | null;
  media_url?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  visible_from?: string | null;
  visible_until?: string | null;
  is_active?: boolean;
  sort_order?: number;
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
    <div className="snap-y snap-mandatory" style={{ scrollSnapType: 'y mandatory' }}>
      {slides.map((s) => (
        <SlideRenderer
          key={s.id}
          slide={s}
          restaurantId={restaurantId!}
          router={router}
        />
      ))}
    </div>
  );
}

export function SlideRenderer({
  slide,
  restaurantId,
  router,
}: {
  slide: SlideRow;
  restaurantId: string;
  router: any;
}) {
  function coerceConfig(raw: any): SlideConfig {
    const cfg = raw && typeof raw === 'object' ? raw : {};
    if (!cfg.background) cfg.background = { kind: 'color', value: '#111', overlay: false };
    if (!Array.isArray(cfg.blocks)) cfg.blocks = [];
    return cfg as SlideConfig;
  }
  const cfg = coerceConfig(slide.config_json);
  const bg = cfg.background;
  const style: React.CSSProperties = {
    minHeight: '100vh',
    height: '100dvh',
    scrollSnapAlign: 'start',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  };
  if (bg?.kind === 'color' && bg.value) {
    style.backgroundColor = bg.value;
  }
  if (bg?.kind === 'image' && bg.value) {
    style.backgroundImage = `url(${bg.value})`;
    style.backgroundSize = bg.fit || 'cover';
    style.backgroundPosition = bg.position || 'center';
  }

  let media: React.ReactNode = null;
  if (bg?.kind === 'video' && bg.value) {
    media = (
      <video
        src={bg.value}
        muted={bg.muted ?? true}
        loop={bg.loop ?? true}
        autoPlay={bg.autoplay ?? true}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: bg.fit || 'cover',
        }}
      />
    );
  }
  const overlay = bg?.overlay ? (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: bg.overlayColor || '#000',
        opacity: bg.overlayOpacity ?? 0.25,
      }}
    />
  ) : null;

  const renderBlock = (b: any) => {
    switch (b.type) {
      case 'heading':
        return (
          <h2 key={b.id} style={{ textAlign: b.align }} className="text-xl font-bold">
            {b.text}
          </h2>
        );
      case 'subheading':
        return (
          <p key={b.id} style={{ textAlign: b.align }} className="mb-3">
            {b.text}
          </p>
        );
      case 'button':
        return (
          <Button
            key={b.id}
            onClick={() => router.push(b.href || slide.cta_href || `/restaurant/menu?restaurant_id=${restaurantId}`)}
            className="mb-2"
          >
            {b.text}
          </Button>
        );
      case 'image':
        return b.url ? (
          <Image key={b.id} src={b.url} alt="" width={b.width || 400} height={b.height || 300} />
        ) : null;
      case 'quote':
        return (
          <blockquote key={b.id} className="mb-2">
            <p>“{b.text}”</p>
            {b.author && <cite className="block text-sm">- {b.author}</cite>}
          </blockquote>
        );
      case 'gallery':
        return (
          <div key={b.id} className="flex gap-2 overflow-x-auto mb-2">
            {b.images.map((src, i) => (
              <Image key={i} src={src} alt="" width={200} height={150} />
            ))}
          </div>
        );
      case 'spacer':
        const sizes: any = { sm: 32, md: 64, lg: 96 };
        return <div key={b.id} style={{ height: sizes[b.size || 'md'] }} />;
      default:
        return null;
    }
  };

  let content: React.ReactNode = null;
  if (cfg.layout === 'split' && cfg.blocks.length >= 2) {
    content = (
      <div className="flex w-full max-w-5xl mx-auto gap-4 items-center justify-center">
        <div className="flex-1 flex justify-center">{renderBlock(cfg.blocks[0])}</div>
        <div className="flex-1">{renderBlock(cfg.blocks[1])}</div>
      </div>
    );
  } else if (cfg.blocks.length > 0) {
    content = cfg.blocks.map(renderBlock);
  } else {
    const href =
      slide.cta_href || `/restaurant/menu?restaurant_id=${restaurantId}`;
    content = (
      <>
        {slide.title && <h2 className="text-xl font-bold">{slide.title}</h2>}
        {slide.subtitle && <p className="mb-3">{slide.subtitle}</p>}
        {slide.cta_label && (
          <Button onClick={() => router.push(href)}>{slide.cta_label}</Button>
        )}
      </>
    );
  }

  return (
    <section style={style} className="w-full text-center p-4">
      {media}
      {overlay}
      <div style={{ position: 'relative', zIndex: 1 }} className="flex flex-col items-center w-full">
        {content}
      </div>
    </section>
  );
}
