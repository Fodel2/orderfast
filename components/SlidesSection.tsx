import React, { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { SlideCfg, SlideBlock, DeviceKind } from './SlidesManager';
import type { SlideRow } from '@/components/customer/home/SlidesContainer';

const TEXT_SIZE_MAP: Record<string, string> = {
  sm: '1.125rem',
  md: '1.5rem',
  lg: '2.5rem',
  xl: '3.5rem',
};

const BUTTON_CLASS = 'inline-flex items-center justify-center rounded-full px-5 py-3 text-base font-semibold shadow';

function useDeviceKind(): DeviceKind {
  const [device, setDevice] = useState<DeviceKind>('desktop');
  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      if (width < 640) setDevice('mobile');
      else if (width < 1024) setDevice('tablet');
      else setDevice('desktop');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return device;
}

function pickFrame(block: SlideBlock, device: DeviceKind) {
  const frames = block.frames || {};
  return (
    frames[device] ||
    frames.desktop ||
    frames.tablet ||
    frames.mobile || {
      x: 10,
      y: 10,
      w: 40,
      h: 20,
      r: 0,
    }
  );
}

function renderBlock(block: SlideBlock) {
  switch (block.kind) {
    case 'heading':
    case 'subheading':
    case 'text': {
      const Tag = block.kind === 'heading' ? 'h2' : block.kind === 'subheading' ? 'h3' : 'p';
      const style: CSSProperties = {
        color: block.color || '#ffffff',
        textAlign: block.align ?? 'left',
        fontSize: block.size ? TEXT_SIZE_MAP[block.size] ?? TEXT_SIZE_MAP.md : undefined,
        fontWeight: block.kind === 'heading' ? 700 : block.kind === 'subheading' ? 600 : 400,
        margin: 0,
      };
      return <Tag style={style}>{block.text}</Tag>;
    }
    case 'button':
      return (
        <a href={block.href || '#'} className={`${BUTTON_CLASS} bg-white text-black`}>
          {block.text || 'Button'}
        </a>
      );
    case 'image':
      if (!block.src) return <div className="h-full w-full rounded-lg bg-neutral-200" />;
      return (
        <img
          src={block.src}
          alt=""
          className="h-full w-full rounded-xl"
          style={{ objectFit: block.fit || 'cover' }}
        />
      );
    case 'quote':
      return (
        <blockquote className="text-white">
          <p className="text-lg italic">“{block.text}”</p>
          {block.author && <cite className="mt-2 block text-sm">— {block.author}</cite>}
        </blockquote>
      );
    case 'gallery':
      return (
        <div className="flex h-full w-full gap-2 overflow-hidden rounded-xl">
          {(block.items || []).map((item) => (
            <img key={item.src} src={item.src} alt={item.alt || ''} className="h-full flex-1 object-cover" />
          ))}
        </div>
      );
    case 'spacer':
      return <div className="h-full w-full" />;
    default:
      return null;
  }
}

function Background({ cfg }: { cfg: SlideCfg }) {
  const bg = cfg.background;
  if (!bg) return null;
  if (bg.type === 'color') {
    return (
      <>
        <div className="absolute inset-0" style={{ background: bg.color || '#111', pointerEvents: 'none' }} />
        {bg.overlay && (
          <div
            className="absolute inset-0"
            style={{
              background: bg.overlay.color,
              opacity: bg.overlay.opacity,
              pointerEvents: 'none',
            }}
          />
        )}
      </>
    );
  }
  if (bg.type === 'image') {
    return (
      <>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: bg.url ? `url(${bg.url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            pointerEvents: 'none',
          }}
        />
        {bg.overlay && (
          <div
            className="absolute inset-0"
            style={{ background: bg.overlay.color, opacity: bg.overlay.opacity, pointerEvents: 'none' }}
          />
        )}
      </>
    );
  }
  if (bg.type === 'video' && bg.url) {
    return (
      <>
        <video
          src={bg.url}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        {bg.overlay && (
          <div
            className="absolute inset-0"
            style={{ background: bg.overlay.color, opacity: bg.overlay.opacity, pointerEvents: 'none' }}
          />
        )}
      </>
    );
  }
  return null;
}

export default function SlidesSection({ slide, cfg }: { slide: SlideRow; cfg: SlideCfg }) {
  const device = useDeviceKind();
  const blocks = useMemo(() => cfg.blocks || [], [cfg.blocks]);

  return (
    <section className="relative flex min-h-screen snap-start items-center justify-center" style={{ height: '100dvh' }}>
      <Background cfg={cfg} />
      <div className="relative h-full w-full" style={{ pointerEvents: 'none' }}>
        {blocks.map((block) => {
          const frame = pickFrame(block, device);
          const style: CSSProperties = {
            position: 'absolute',
            left: `${frame.x}%`,
            top: `${frame.y}%`,
            width: `${frame.w}%`,
            height: `${frame.h}%`,
            transform: `rotate(${frame.r ?? 0}deg)`,
            transformOrigin: 'top left',
            pointerEvents: 'auto',
          };
          return (
            <div key={block.id} style={style} className="flex h-full w-full items-center justify-center">
              {renderBlock(block)}
            </div>
          );
        })}
      </div>
    </section>
  );
}

