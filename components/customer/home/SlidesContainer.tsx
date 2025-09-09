import { useEffect, useState, useRef, type CSSProperties, type ReactNode } from 'react';
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
  editable = false,
  onBlockSelect,
  onPosChange,
  selectedId,
  onTextChange,
  blockWrapper,
}: {
  slide: SlideRow;
  restaurantId: string;
  router: any;
  editable?: boolean;
  onBlockSelect?: (id: string) => void;
  onPosChange?: (id: string, pos: { xPct: number; yPct: number; wPct?: number; hPct?: number; z?: number; rotateDeg?: number }) => void;
  selectedId?: string | null;
  onTextChange?: (id: string, text: string) => void;
  blockWrapper?: (
    b: any,
    content: ReactNode,
    pos: { xPct: number; yPct: number; wPct?: number; hPct?: number; z?: number; rotateDeg?: number }
  ) => ReactNode;
}) {
  function coerceConfig(raw: any): SlideConfig {
    const cfg = raw && typeof raw === 'object' ? raw : {};
    if (!cfg.mode) cfg.mode = 'structured';
    if (!cfg.background) cfg.background = { kind: 'color', value: '#111', overlay: false };
    if (!Array.isArray(cfg.blocks)) cfg.blocks = [];
    if (!cfg.positions) cfg.positions = {};
    return cfg as SlideConfig;
  }
  const cfg = coerceConfig(slide.config_json);
  const bg = cfg.background;
  const style: CSSProperties = {
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

  let media: ReactNode = null;
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

  const renderBlockContent = (b: any) => {
    switch (b.type) {
      case 'heading':
        const hStyle: CSSProperties = {
          textAlign: b.align,
          fontSize: b.fontSize ? `${b.fontSize}px` : undefined,
          fontFamily: b.fontFamily,
          color: b.color,
          transform: b.rotateDeg ? `rotate(${b.rotateDeg}deg)` : undefined,
        };
        const hContent = b.overlay ? (
          <span
            style={{
              background: b.overlay.color,
              opacity: b.overlay.opacity,
              padding: '0 0.25em',
              display: 'inline-block',
            }}
          >
            {b.text}
          </span>
        ) : (
          b.text
        );
        const hProps =
          editable && selectedId === b.id
            ? {
                contentEditable: true,
                suppressContentEditableWarning: true,
                onInput: (e: any) =>
                  onTextChange?.(b.id, e.currentTarget.textContent || ''),
              }
            : {};
        return (
          <h2 key={b.id} style={hStyle} className="font-bold" {...hProps}>
            {hContent}
          </h2>
        );
      case 'subheading':
        const pStyle: CSSProperties = {
          textAlign: b.align,
          fontSize: b.fontSize ? `${b.fontSize}px` : undefined,
          fontFamily: b.fontFamily,
          color: b.color,
          transform: b.rotateDeg ? `rotate(${b.rotateDeg}deg)` : undefined,
        };
        const pContent = b.overlay ? (
          <span
            style={{
              background: b.overlay.color,
              opacity: b.overlay.opacity,
              padding: '0 0.25em',
              display: 'inline-block',
            }}
          >
            {b.text}
          </span>
        ) : (
          b.text
        );
        const pProps =
          editable && selectedId === b.id
            ? {
                contentEditable: true,
                suppressContentEditableWarning: true,
                onInput: (e: any) =>
                  onTextChange?.(b.id, e.currentTarget.textContent || ''),
              }
            : {};
        return (
          <p key={b.id} style={pStyle} className="mb-3" {...pProps}>
            {pContent}
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
        if (!b.url) return null;
        const img = (
          <Image key={b.id} src={b.url} alt="" width={b.width || 400} height={b.height || 300} />
        );
        const imgWrapperStyle: CSSProperties = {
          position: 'relative',
          display: 'inline-block',
          transform: b.rotateDeg ? `rotate(${b.rotateDeg}deg)` : undefined,
        };
        return (
          <div key={b.id} style={imgWrapperStyle}>
            {img}
            {b.overlay && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: b.overlay.color,
                  opacity: b.overlay.opacity,
                }}
              />
            )}
          </div>
        );
      case 'quote':
        const qProps =
          editable && selectedId === b.id
            ? {
                contentEditable: true,
                suppressContentEditableWarning: true,
                onInput: (e: any) =>
                  onTextChange?.(b.id, e.currentTarget.textContent || ''),
              }
            : {};
        return (
          <blockquote key={b.id} className="mb-2" {...qProps}>
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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<string | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
      onPosChange?.(draggingRef.current, { xPct, yPct });
    }
    function onUp() {
      draggingRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onPosChange]);

  const renderBlock = (b: any) => {
    if (cfg.mode === 'freeform') {
      const pos = cfg.positions[b.id] || { xPct: 50, yPct: 50 };
      const rot = pos.rotateDeg ?? b.rotateDeg;
      const style: CSSProperties = {
        position: 'absolute',
        left: `${pos.xPct}%`,
        top: `${pos.yPct}%`,
        transform: `translate(-50%, -50%)${rot ? ` rotate(${rot}deg)` : ''}`,
        width: pos.wPct ? `${pos.wPct}%` : undefined,
        height: pos.hPct ? `${pos.hPct}%` : undefined,
        zIndex: pos.z || 1,
        cursor: editable ? 'move' : 'default',
      };
      const defaultNode = (
        <div
          key={b.id}
          style={style}
          onMouseDown={(e) => {
            if (!editable) return;
            draggingRef.current = b.id;
            e.preventDefault();
            onBlockSelect?.(b.id);
          }}
          onClick={() => onBlockSelect?.(b.id)}
        >
          {renderBlockContent(b)}
        </div>
      );
      return blockWrapper
        ? blockWrapper(
            b,
            renderBlockContent(b),
            { xPct: pos.xPct, yPct: pos.yPct, wPct: pos.wPct, hPct: pos.hPct, z: pos.z, rotateDeg: rot }
          )
        : defaultNode;
    }
    const inner = renderBlockContent(b);
    return blockWrapper ? blockWrapper(b, inner, { xPct: 0, yPct: 0 }) : (
      <div key={b.id} onClick={() => onBlockSelect?.(b.id)}>
        {inner}
      </div>
    );
  };

  let content: ReactNode = null;
  if (cfg.layout === 'split' && cfg.blocks.length >= 2 && cfg.mode === 'structured') {
    content = (
      <div className="flex w-full max-w-5xl mx-auto gap-4 items-center justify-center">
        <div className="flex-1 flex justify-center">{renderBlock(cfg.blocks[0])}</div>
        <div className="flex-1">{renderBlock(cfg.blocks[1])}</div>
      </div>
    );
  } else if (cfg.blocks.length > 0) {
    if (cfg.mode === 'freeform') {
      content = cfg.blocks.map(renderBlock);
    } else {
      content = cfg.blocks.map((b) => renderBlock(b));
    }
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

  const groupAlign = cfg.structuredGroupAlign || { v: 'center', h: 'center' };
  const wrapperStyle: CSSProperties =
    cfg.mode === 'freeform'
      ? { position: 'relative', zIndex: 1, width: '100%', height: '100%' }
      : {
          position: 'relative',
          zIndex: 1,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent:
            groupAlign.v === 'top'
              ? 'flex-start'
              : groupAlign.v === 'bottom'
              ? 'flex-end'
              : 'center',
          alignItems:
            groupAlign.h === 'left'
              ? 'flex-start'
              : groupAlign.h === 'right'
              ? 'flex-end'
              : 'center',
        };

  return (
    <section ref={containerRef} style={style} className="w-full text-center p-4">
      {media}
      {overlay}
      <div style={wrapperStyle}>{content}</div>
    </section>
  );
}
