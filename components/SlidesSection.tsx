import React, { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  BLOCK_INTERACTION_GLOBAL_STYLES,
  getBlockInteractionPresentation,
  type SlideCfg,
  type SlideBlock,
  type DeviceKind,
  type BlockBackground,
  type BlockBackgroundGradientDirection,
  type BlockShadowPreset,
  resolveQuoteConfig,
  resolveBlockVisibility,
} from './SlidesManager';
import type { SlideRow } from '@/components/customer/home/SlidesContainer';

const TEXT_SIZE_MAP: Record<string, string> = {
  sm: '1.125rem',
  md: '1.5rem',
  lg: '2.5rem',
  xl: '3.5rem',
};

const BUTTON_CLASS = 'inline-flex items-center justify-center rounded-full px-5 py-3 text-base font-semibold shadow';

const BLOCK_SHADOW_VALUE: Record<BlockShadowPreset, string | undefined> = {
  none: undefined,
  sm: '0 1px 2px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)',
  md: '0 4px 6px rgba(15, 23, 42, 0.1), 0 2px 4px rgba(15, 23, 42, 0.06)',
  lg: '0 10px 15px rgba(15, 23, 42, 0.12), 0 4px 6px rgba(15, 23, 42, 0.05)',
};

const BLOCK_GRADIENT_DIRECTION_MAP: Record<BlockBackgroundGradientDirection, string> = {
  'to-top': 'to top',
  'to-bottom': 'to bottom',
  'to-left': 'to left',
  'to-right': 'to right',
};

const DEFAULT_BLOCK_BACKGROUND_COLOR = '#ffffff';
const DEFAULT_BLOCK_GRADIENT_FROM = 'rgba(15, 23, 42, 0.45)';
const DEFAULT_BLOCK_GRADIENT_TO = 'rgba(15, 23, 42, 0.05)';

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
      {
        const quote = resolveQuoteConfig(block);
        const trimmedAuthor = quote.author.trim();
        const showReviewRating = quote.useReview && Boolean(quote.reviewId);
        return (
          <blockquote className="text-white" style={{ textAlign: quote.align }}>
            <p className="text-lg italic">“{quote.text}”</p>
            {trimmedAuthor.length > 0 ? (
              <cite className="mt-2 block text-sm">— {trimmedAuthor}</cite>
            ) : null}
            {showReviewRating ? (
              <p className={`text-base opacity-90 ${trimmedAuthor.length > 0 ? 'mt-1' : 'mt-3'}`} aria-label="Five star review">
                {'⭐️⭐️⭐️⭐️⭐️'}
              </p>
            ) : null}
          </blockquote>
        );
      }
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

function getBlockChromeStyle(block: SlideBlock): CSSProperties {
  const style: CSSProperties = {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'transparent',
  };

  const shadowKey = (block.boxShadow ?? 'none') as BlockShadowPreset;
  const shadowValue = BLOCK_SHADOW_VALUE[shadowKey];
  if (shadowValue) {
    style.boxShadow = shadowValue;
  }

  const borderWidth =
    typeof block.borderWidth === 'number' && Number.isFinite(block.borderWidth)
      ? Math.max(0, block.borderWidth)
      : undefined;
  const borderColor =
    typeof block.borderColor === 'string' ? block.borderColor : undefined;

  if (borderWidth && borderWidth > 0) {
    style.borderWidth = borderWidth;
    style.borderStyle = 'solid';
    style.borderColor = borderColor ?? 'rgba(15, 23, 42, 0.12)';
  } else if (borderColor && borderColor !== 'transparent') {
    style.borderWidth = 1;
    style.borderStyle = 'solid';
    style.borderColor = borderColor;
  }

  const borderRadius =
    typeof block.borderRadius === 'number' && Number.isFinite(block.borderRadius)
      ? Math.max(0, block.borderRadius)
      : undefined;
  if (borderRadius !== undefined) {
    style.borderRadius = borderRadius;
  }

  const background = block.background as BlockBackground | undefined;
  const backgroundType = background?.type ?? 'none';
  let shouldClip = false;

  if (backgroundType === 'color') {
    style.backgroundColor = background?.color ?? DEFAULT_BLOCK_BACKGROUND_COLOR;
    shouldClip = true;
  } else if (backgroundType === 'gradient') {
    const gradient = background?.gradient ?? {};
    const from =
      typeof gradient.from === 'string'
        ? gradient.from
        : DEFAULT_BLOCK_GRADIENT_FROM;
    const to =
      typeof gradient.to === 'string' ? gradient.to : DEFAULT_BLOCK_GRADIENT_TO;
    const rawDirection =
      typeof gradient.direction === 'string'
        ? gradient.direction.replace(/\s+/g, '-').toLowerCase()
        : undefined;
    const directionKey =
      rawDirection === 'to-top' ||
      rawDirection === 'to-left' ||
      rawDirection === 'to-right' ||
      rawDirection === 'to-bottom'
        ? (rawDirection as BlockBackgroundGradientDirection)
        : 'to-bottom';
    const direction = BLOCK_GRADIENT_DIRECTION_MAP[directionKey];
    style.backgroundImage = `linear-gradient(${direction}, ${from}, ${to})`;
    shouldClip = true;
  } else if (backgroundType === 'image') {
    const url = background?.image?.url;
    if (url) {
      style.backgroundImage = `url(${url})`;
      style.backgroundSize = 'cover';
      style.backgroundPosition = 'center';
      style.backgroundRepeat = 'no-repeat';
      shouldClip = true;
    }
  }

  if (shouldClip && borderRadius !== undefined && borderRadius > 0) {
    style.overflow = 'hidden';
  }

  return style;
}

export default function SlidesSection({ slide, cfg }: { slide: SlideRow; cfg: SlideCfg }) {
  const device = useDeviceKind();
  const blocks = useMemo(() => cfg.blocks || [], [cfg.blocks]);

  return (
    <>
      <style jsx global>{BLOCK_INTERACTION_GLOBAL_STYLES}</style>
      <section className="relative flex min-h-screen snap-start items-center justify-center" style={{ height: '100dvh' }}>
        <Background cfg={cfg} />
        <div className="relative h-full w-full" style={{ pointerEvents: 'none' }}>
          {blocks.map((block) => {
            const visibility = resolveBlockVisibility(block);
            if (!visibility[device]) {
              return null;
            }
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
            const interaction = getBlockInteractionPresentation(block);
            const chromeStyle = {
              ...getBlockChromeStyle(block),
              ...(interaction.style || {}),
            } as CSSProperties;
            const chromeClasses = [
              'flex h-full w-full items-center justify-center',
              ...(interaction.classNames ?? []),
            ].join(' ');
            return (
              <div key={block.id} style={style} className="flex h-full w-full items-center justify-center">
                <div style={chromeStyle} className={chromeClasses}>
                  {renderBlock(block)}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

