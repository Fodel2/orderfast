import React, { useState } from 'react';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import type { SlideConfig } from './SlideModal';
import type { SlideRow } from '@/components/customer/home/SlidesContainer';

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

function InteractiveBox({ id, selected, debug, deviceFrameRef, pos, onChange, children }: InteractiveBoxProps) {
  const startRef = React.useRef<{
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
    outline: '2px dashed #ec4899',
    outlineOffset: 0,
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
      <div
        style={{
          position: 'absolute',
          left: -2,
          top: -18,
          fontSize: 10,
          background: '#ec4899',
          color: '#fff',
          padding: '1px 4px',
          borderRadius: 4,
        }}
      >
        {id.slice(0, 6)}
      </div>
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
        >{`x:${pos.xPct.toFixed(1)} y:${pos.yPct.toFixed(1)} w:${pos.wPct?.toFixed(1) ?? '-'} h:${
          pos.hPct?.toFixed(1) ?? '-'
        } r:${pos.rotateDeg ?? 0}`}</div>
      )}
    </div>
  );
}

export default function SlidesSection({
  slide,
  cfg,
  setCfg,
  editingEnabled = false,
  showEditorDebug = false,
  deviceFrameRef,
}: {
  slide: SlideRow;
  cfg: SlideConfig;
  setCfg: React.Dispatch<React.SetStateAction<SlideConfig>>;
  editingEnabled?: boolean;
  showEditorDebug?: boolean;
  deviceFrameRef?: React.RefObject<HTMLDivElement>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const media = bg?.kind === 'video' && bg.value ? (
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
  ) : null;

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
      case 'subheading': {
        const Comp = b.type === 'heading' ? 'h2' : 'p';
        const st: CSSProperties = {
          textAlign: b.align,
          fontSize: b.fontSize ? `${b.fontSize}px` : undefined,
          fontFamily: b.fontFamily,
          color: b.color,
          transform: b.rotateDeg ? `rotate(${b.rotateDeg}deg)` : undefined,
        };
        const content = b.overlay ? (
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
        const editableProps =
          editingEnabled && selectedId === b.id
            ? {
                contentEditable: true,
                suppressContentEditableWarning: true,
                onInput: (e: any) =>
                  setCfg((p) => ({
                    ...p,
                    blocks: p.blocks.map((x) =>
                      x.id === b.id ? { ...x, text: e.currentTarget.textContent || '' } : x
                    ),
                  })),
              }
            : {};
        return (
          <Comp
            key={b.id}
            style={st}
            {...editableProps}
            className={b.type === 'heading' ? 'font-bold' : 'mb-3'}
          >
            {content}
          </Comp>
        );
      }
      case 'button':
        return (
          <Button key={b.id} className="mb-2" onClick={(e) => e.preventDefault()}>
            {b.text}
          </Button>
        );
      case 'image':
        if (!b.url) return null;
        const img = <Image key={b.id} src={b.url} alt="" width={b.width || 400} height={b.height || 300} />;
        const wrap: CSSProperties = {
          position: 'relative',
          display: 'inline-block',
          transform: b.rotateDeg ? `rotate(${b.rotateDeg}deg)` : undefined,
        };
        return (
          <div key={b.id} style={wrap}>
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
        return (
          <blockquote key={b.id} className="mb-2">
            <p>“{b.text}”</p>
            {b.author && <cite className="block text-sm">- {b.author}</cite>}
          </blockquote>
        );
      case 'gallery':
        return (
          <div key={b.id} className="flex gap-2 overflow-x-auto mb-2">
            {b.images.map((src: string, i: number) => (
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
    const pos = cfg.positions?.[b.id] ?? {
      xPct: 50,
      yPct: 45,
      wPct: undefined,
      hPct: undefined,
      z: 3,
      rotateDeg: 0,
    };
    if (editingEnabled) {
      return (
        <InteractiveBox
          key={b.id}
          id={b.id}
          selected={selectedId === b.id}
          debug={showEditorDebug}
          deviceFrameRef={deviceFrameRef!}
          pos={pos}
          onChange={(next) =>
            setCfg((p) => ({ ...p, positions: { ...(p.positions || {}), [b.id]: next } }))
          }
        >
          {renderBlockContent(b)}
        </InteractiveBox>
      );
    }
    const st: CSSProperties = {
      position: 'absolute',
      left: `${pos.xPct}%`,
      top: `${pos.yPct}%`,
      transform: `translate(-50%, -50%) rotate(${pos.rotateDeg ?? 0}deg)`,
      width: pos.wPct ? `${pos.wPct}%` : undefined,
      height: pos.hPct ? `${pos.hPct}%` : undefined,
      zIndex: pos.z || 3,
    };
    return (
      <div key={b.id} style={st}>
        {renderBlockContent(b)}
      </div>
    );
  };

  return (
    <section style={style} onClick={() => setSelectedId(null)}>
      {media}
      {overlay}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {(cfg.blocks || []).map((b) => (
          <div key={b.id} onClick={(e) => { e.stopPropagation(); setSelectedId(b.id); }}>
            {renderBlock(b)}
          </div>
        ))}
      </div>
      {editingEnabled && showEditorDebug && (
        <>
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
            {selectedId || 'none'}
          </div>
        </>
      )}
    </section>
  );
}

