import { useEffect, useState, useRef, type CSSProperties, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import resolveRestaurantId from '@/lib/resolveRestaurantId';
import { supabase } from '@/lib/supabaseClient';
import type { SlideConfig } from '@/components/SlideModal';

type InteractiveBoxProps = {
  id: string;
  selected: boolean;
  debug: boolean;
  deviceFrameRef: React.RefObject<HTMLDivElement>;
  pos: { xPct: number; yPct: number; wPct?: number; hPct?: number; z?: number; rotateDeg?: number };
  onChange: (next: {
    xPct: number;
    yPct: number;
    wPct?: number;
    hPct?: number;
    z?: number;
    rotateDeg?: number;
  }) => void;
  children: React.ReactNode;
};

function InteractiveBox({ selected, debug, deviceFrameRef, pos, onChange, children }: InteractiveBoxProps) {
  const startRef = useRef<{
    type: 'move' | 'resize' | 'rotate';
    x: number;
    y: number;
    rect: DOMRect;
    pos: any;
    corner?: string;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const getFrame = () => deviceFrameRef.current!;
  const clampPct = (v: number) => Math.min(100, Math.max(0, v));
  const pct = (px: number, total: number) => clampPct((px / total) * 100);

  const onPointerDownMove = (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = getFrame().getBoundingClientRect();
    startRef.current = { type: 'move', x: e.clientX, y: e.clientY, rect, pos: { ...pos } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerDownResize = (corner: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = getFrame().getBoundingClientRect();
    startRef.current = { type: 'resize', corner, x: e.clientX, y: e.clientY, rect, pos: { ...pos } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerDownRotate = (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = getFrame().getBoundingClientRect();
    startRef.current = { type: 'rotate', x: e.clientX, y: e.clientY, rect, pos: { ...pos } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = startRef.current;
    if (!s) return;
    const rect = s.rect;
    if (s.type === 'move') {
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      const newX = (s.pos.xPct / 100) * rect.width + dx;
      const newY = (s.pos.yPct / 100) * rect.height + dy;
      onChange({ ...s.pos, xPct: pct(newX, rect.width), yPct: pct(newY, rect.height) });
    } else if (s.type === 'resize') {
      const baseW = ((s.pos.wPct ?? 40) / 100) * rect.width;
      const baseH = ((s.pos.hPct ?? 20) / 100) * rect.height;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      let w = baseW,
        h = baseH;
      if (s.corner?.includes('e')) w = baseW + dx;
      if (s.corner?.includes('w')) w = baseW - dx;
      if (s.corner?.includes('s')) h = baseH + dy;
      if (s.corner?.includes('n')) h = baseH - dy;
      onChange({ ...s.pos, wPct: pct(Math.max(40, w), rect.width), hPct: pct(Math.max(20, h), rect.height) });
    } else if (s.type === 'rotate') {
      const cx = rect.left + (s.pos.xPct / 100) * rect.width;
      const cy = rect.top + (s.pos.yPct / 100) * rect.height;
      const ang = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
      onChange({ ...s.pos, rotateDeg: Math.round(ang) });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    startRef.current = null;
    setDragging(false);
  };

  const boxStyle: CSSProperties = {
    position: 'absolute',
    left: `${pos.xPct}%`,
    top: `${pos.yPct}%`,
    transform: `translate(-50%, -50%) rotate(${pos.rotateDeg ?? 0}deg)`,
    width: pos.wPct ? `${pos.wPct}%` : 'auto',
    height: pos.hPct ? `${pos.hPct}%` : 'auto',
    zIndex: pos.z || 3,
    touchAction: 'none',
    boxShadow: dragging ? '0 0 0 3px rgba(99,102,241,.45)' : undefined,
    opacity: dragging ? 0.95 : undefined,
  };
  const handle: CSSProperties = {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 9999,
    background: '#fff',
    border: '1px solid #111',
  };

  return (
    <div
      style={boxStyle}
      onPointerDown={onPointerDownMove}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {children}
      {selected && (
        <>
          <div
            onPointerDown={onPointerDownRotate}
            style={{
              position: 'absolute',
              left: '50%',
              top: -24,
              transform: 'translateX(-50%)',
              width: 14,
              height: 14,
              borderRadius: 9999,
              background: '#fff',
              border: '1px solid #111',
            }}
          />
          {[
            ['nw', { left: -5, top: -5 }],
            ['n', { left: '50%', top: -5, transform: 'translateX(-50%)' }],
            ['ne', { right: -5, top: -5 }],
            ['e', { right: -5, top: '50%', transform: 'translateY(-50%)' }],
            ['se', { right: -5, bottom: -5 }],
            ['s', { left: '50%', bottom: -5, transform: 'translateX(-50%)' }],
            ['sw', { left: -5, bottom: -5 }],
            ['w', { left: -5, top: '50%', transform: 'translateY(-50%)' }],
          ].map(([corner, style]) => (
            <div
              key={corner as string}
              onPointerDown={onPointerDownResize(corner as string)}
              style={{ ...handle, ...(style as CSSProperties) }}
            />
          ))}
        </>
      )}
      {debug && (
        <div
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            fontSize: 10,
            background: '#111',
            color: '#fff',
            padding: '1px 4px',
            borderRadius: 4,
          }}
        >{`x:${pos.xPct.toFixed(1)} y:${pos.yPct.toFixed(1)} w:${pos.wPct?.toFixed(1) ?? '-'} h:${pos.hPct?.toFixed(1) ?? '-'} r:${pos.rotateDeg ?? 0}`}</div>
      )}
    </div>
  );
}

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
        <SlidesSection
          key={s.id}
          slide={s}
          restaurantId={restaurantId!}
          router={router}
        />
      ))}
    </div>
  );
}

export function SlidesSection({
  slide,
  restaurantId,
  router,
  cfg: cfgProp,
  setCfg,
  editingEnabled = false,
  showEditorDebug = false,
  selectedId,
  onSelect,
  deviceFrameRef,
}: {
  slide: SlideRow;
  restaurantId: string;
  router: any;
  cfg?: SlideConfig;
  setCfg?: Dispatch<SetStateAction<SlideConfig>>;
  editingEnabled?: boolean;
  showEditorDebug?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  deviceFrameRef?: React.RefObject<HTMLDivElement>;
}) {
  function coerceConfig(raw: any): SlideConfig {
    const cfg = raw && typeof raw === 'object' ? raw : {};
    if (!cfg.mode) cfg.mode = 'structured';
    if (!cfg.background) cfg.background = { kind: 'color', value: '#111', overlay: false };
    if (!Array.isArray(cfg.blocks)) cfg.blocks = [];
    if (!cfg.positions) cfg.positions = {};
    return cfg as SlideConfig;
  }
  const cfg = coerceConfig(cfgProp ?? slide.config_json);
  const editable = editingEnabled;
  const updateBlock = (id: string, patch: any) =>
    setCfg?.((p) => ({
      ...p,
      blocks: p.blocks.map((b: any) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  const bg = cfg.background;
  const style: CSSProperties = {
    position: 'relative',
    minHeight: '100vh',
    height: '100dvh',
    scrollSnapAlign: 'start',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
          pointerEvents: 'none',
          zIndex: 0,
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
        pointerEvents: 'none',
        zIndex: 0,
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
                  updateBlock(b.id, { text: e.currentTarget.textContent || '' }),
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
                  updateBlock(b.id, { text: e.currentTarget.textContent || '' }),
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
                  updateBlock(b.id, { text: e.currentTarget.textContent || '' }),
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
      const content = renderBlockContent(b);
      if (editingEnabled) {
        return (
          <InteractiveBox
            key={b.id}
            id={b.id}
            selected={selectedId === b.id}
            debug={!!showEditorDebug}
            deviceFrameRef={deviceFrameRef!}
            pos={{ xPct: pos.xPct, yPct: pos.yPct, wPct: pos.wPct, hPct: pos.hPct, z: pos.z, rotateDeg: rot }}
            onChange={(next) =>
              setCfg?.((p) => ({
                ...p,
                positions: { ...(p.positions || {}), [b.id]: next },
              }))
            }
          >
            <div onClick={() => onSelect?.(b.id)}>{content}</div>
          </InteractiveBox>
        );
      }
      return (
        <div
          key={b.id}
          style={style}
          onClick={editingEnabled ? () => onSelect?.(b.id) : undefined}
        >
          {content}
        </div>
      );
    }
    const inner = renderBlockContent(b);
    if (editingEnabled) {
      const pos = cfg.positions[b.id] || { xPct: 50, yPct: 45 };
      return (
        <InteractiveBox
          key={b.id}
          id={b.id}
          selected={selectedId === b.id}
          debug={!!showEditorDebug}
          deviceFrameRef={deviceFrameRef!}
          pos={pos}
          onChange={(next) =>
            setCfg?.((p) => ({
              ...p,
              positions: { ...(p.positions || {}), [b.id]: next },
            }))
          }
        >
          <div onClick={() => onSelect?.(b.id)}>{inner}</div>
        </InteractiveBox>
      );
    }
    return (
      <div key={b.id} onClick={editingEnabled ? () => onSelect?.(b.id) : undefined}>
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
  } else if (!editingEnabled) {
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
  } else {
    content = null;
  }

  const groupAlign = cfg.structuredGroupAlign || { v: 'center', h: 'center' };
  const wrapperStyle: CSSProperties =
    cfg.mode === 'freeform'
      ? { position: 'relative', zIndex: 2, width: '100%', height: '100%', pointerEvents: 'auto' }
      : {
          position: 'relative',
          zIndex: 2,
          width: '100%',
          height: '100%',
          pointerEvents: 'auto',
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

  const selPos = selectedId ? cfg.positions[selectedId] : undefined;

  return (
    <section style={style} className="w-full text-center p-4">
      {editingEnabled && showEditorDebug && (
        <div
          style={{
            position: 'absolute',
            right: 8,
            top: 8,
            zIndex: 9999,
            background: '#111',
            color: '#fff',
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 6,
            opacity: 0.75,
          }}
        >
          EDITOR MODE
        </div>
      )}
      {editingEnabled && showEditorDebug && selectedId && selPos && (
        <>
          {/* TODO: remove debug HUD once verified */}
          <div
            style={{
              position: 'absolute',
              left: 8,
              top: 8,
              zIndex: 9999,
              background: 'rgba(17,17,17,.85)',
              color: '#fff',
              fontSize: 11,
              padding: '6px 8px',
              borderRadius: 6,
              lineHeight: 1.2,
              maxWidth: 260,
            }}
          >
            <div>{selectedId}</div>
            <div>
              x:{selPos.xPct.toFixed(1)} y:{selPos.yPct.toFixed(1)}
            </div>
            <div>
              w:{selPos.wPct?.toFixed(1) ?? '-'} h:{selPos.hPct?.toFixed(1) ?? '-'}
            </div>
            <div>rot:{selPos.rotateDeg ?? 0}</div>
          </div>
        </>
      )}
      {media}
      {overlay}
      <div style={wrapperStyle}>{content}</div>
    </section>
  );
}
