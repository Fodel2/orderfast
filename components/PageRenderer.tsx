import React, { useEffect, useState } from 'react';

import { getFontStackFromId } from '@/lib/fonts';
import { tokens } from '@/src/ui/tokens';

export type DeviceKind = 'mobile' | 'tablet' | 'desktop';

export type HeaderBlock = {
  id: string;
  type: 'header';
  title: string;
  subtitle?: string;
  tagline?: string;
  backgroundImageUrl?: string | null;
  backgroundImageFit?: 'cover' | 'contain';
  backgroundImagePosition?: 'left' | 'center' | 'right';
  overlayEnabled?: boolean;
  overlayColor?: string;
  overlayOpacity?: number;
  fontFamily?: string;
  fontWeight?: number;
  titleFontSize?: number;
  titleLineHeight?: number;
  titleLetterSpacing?: number;
  titleColor?: string;
  subtitleColor?: string;
  taglineColor?: string;
  align?: 'left' | 'center' | 'right';
  paddingTop?: number;
  paddingBottom?: number;
  fullWidth?: boolean;
};

export type Block =
  | { id: string; type: 'heading'; text: string; level?: 1 | 2 | 3; align?: 'left' | 'center' | 'right' }
  | { id: string; type: 'text'; text: string; align?: 'left' | 'center' | 'right' }
  | { id: string; type: 'image'; src: string; alt?: string; width?: number; radius?: 'none' | 'lg' | '2xl' }
  | {
      id: string;
      type: 'button';
      label: string;
      href?: string;
      target?: '_self' | '_blank';
      style?: 'primary' | 'outline';
      align?: 'left' | 'center' | 'right';
    }
  | { id: string; type: 'divider' }
  | { id: string; type: 'spacer'; height?: number }
  | { id: string; type: 'two-col'; left: Block[]; right: Block[]; ratio?: '1-1' | '1-2' | '2-1'; gap?: number }
  | HeaderBlock;

type PageRendererProps = {
  blocks: Block[];
  device?: DeviceKind;
};

function useResponsiveDevice(override?: DeviceKind): DeviceKind {
  const [device, setDevice] = useState<DeviceKind>(override ?? 'desktop');

  useEffect(() => {
    if (override) {
      setDevice(override);
      return;
    }

    const resolveDevice = () => {
      if (typeof window === 'undefined') return;
      const width = window.innerWidth;
      if (width < 640) {
        setDevice('mobile');
      } else if (width < 1024) {
        setDevice('tablet');
      } else {
        setDevice('desktop');
      }
    };

    resolveDevice();
    window.addEventListener('resize', resolveDevice);
    return () => {
      window.removeEventListener('resize', resolveDevice);
    };
  }, [override]);

  return override ?? device;
}

const clampNumber = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const scaleForDevice: Record<DeviceKind, number> = {
  mobile: 0.65,
  tablet: 0.85,
  desktop: 1,
};

const paddingScale: Record<DeviceKind, number> = {
  mobile: 0.6,
  tablet: 0.85,
  desktop: 1,
};

const alignToFlex: Record<'left' | 'center' | 'right', 'flex-start' | 'center' | 'flex-end'> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

const hexToRgba = (value: string, alpha: number) => {
  const normalized = (value ?? '').trim();
  if (!normalized) {
    return `rgba(15, 23, 42, ${alpha})`;
  }
  if (normalized.startsWith('rgba')) {
    return normalized;
  }
  if (normalized.startsWith('rgb(')) {
    const channels = normalized
      .slice(4, -1)
      .split(',')
      .map((channel) => Number.parseInt(channel.trim(), 10));
    if (channels.length === 3 && channels.every((channel) => Number.isFinite(channel))) {
      return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
    }
  }
  const raw = normalized.startsWith('#') ? normalized.slice(1) : normalized;
  if (raw.length === 3) {
    const r = Number.parseInt(raw[0]! + raw[0]!, 16);
    const g = Number.parseInt(raw[1]! + raw[1]!, 16);
    const b = Number.parseInt(raw[2]! + raw[2]!, 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const match = raw.match(/^[0-9a-fA-F]{6}/);
  if (!match) {
    return `rgba(15, 23, 42, ${alpha})`;
  }
  const r = Number.parseInt(match[0]!.slice(0, 2), 16);
  const g = Number.parseInt(match[0]!.slice(2, 4), 16);
  const b = Number.parseInt(match[0]!.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const DEFAULT_TITLE_FONT_SIZE = 48;
const DEFAULT_TITLE_LINE_HEIGHT = 1.1;
const DEFAULT_PADDING = 128;

export default function PageRenderer({ blocks, device }: PageRendererProps) {
  const currentDevice = useResponsiveDevice(device);

  const renderHeaderBlock = (block: HeaderBlock) => {
    const scale = scaleForDevice[currentDevice];
    const paddingMultiplier = paddingScale[currentDevice];
    const paddingTop = Math.round(
      clampNumber(block.paddingTop ?? DEFAULT_PADDING, 24, 320) * paddingMultiplier,
    );
    const paddingBottom = Math.round(
      clampNumber(block.paddingBottom ?? DEFAULT_PADDING, 24, 320) * paddingMultiplier,
    );
    const titleSize = Math.round(
      clampNumber(block.titleFontSize ?? DEFAULT_TITLE_FONT_SIZE, 24, 120) * scale,
    );
    const lineHeight = block.titleLineHeight ?? DEFAULT_TITLE_LINE_HEIGHT;
    const letterSpacing = block.titleLetterSpacing ?? -1;
    const fontWeight = block.fontWeight ?? 700;
    const fontFamily = getFontStackFromId(block.fontFamily) ?? tokens.fonts.sans;
    const align = block.align ?? 'center';
    const alignItems = alignToFlex[align];
    const textAlign = align;
    const subtitle = block.subtitle?.trim();
    const tagline = block.tagline?.trim();
    const subtitleSize = Math.round(titleSize * 0.45);
    const taglineSize = Math.round(titleSize * 0.3);
    const titleColor = block.titleColor ?? '#ffffff';
    const subtitleColor = block.subtitleColor ?? 'rgba(255, 255, 255, 0.9)';
    const taglineColor = block.taglineColor ?? 'rgba(255, 255, 255, 0.75)';
    const overlayOpacity = clampNumber(block.overlayOpacity ?? 60, 0, 100) / 100;
    const overlayEnabled = block.overlayEnabled ?? false;
    const overlayColor = overlayEnabled
      ? hexToRgba(block.overlayColor ?? '#0f172a', overlayOpacity)
      : 'transparent';
    const backgroundSize = block.backgroundImageFit ?? 'cover';
    const backgroundPosition = `${block.backgroundImagePosition ?? 'center'} center`;
    const horizontalPaddingBase = tokens.spacing.xl;
    const horizontalPadding = Math.max(
      tokens.spacing.md,
      Math.round(horizontalPaddingBase * (paddingMultiplier > 1 ? 1 : paddingMultiplier + 0.2)),
    );

    return (
      <section
        key={block.id}
        style={{
          position: 'relative',
          borderRadius: tokens.radius.lg,
          overflow: 'hidden',
          backgroundColor: tokens.colors.surfaceInverse,
          color: tokens.colors.textOnDark,
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'center',
            backgroundImage: block.backgroundImageUrl
              ? `url(${block.backgroundImageUrl})`
              : undefined,
            backgroundSize,
            backgroundPosition,
            backgroundRepeat: 'no-repeat',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: overlayColor,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'relative',
              width: '100%',
              paddingTop,
              paddingBottom,
              paddingLeft: horizontalPadding,
              paddingRight: horizontalPadding,
              boxSizing: 'border-box',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: block.fullWidth ? '100%' : 960,
                margin: block.fullWidth ? 0 : '0 auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems,
                textAlign,
                gap: tokens.spacing.sm,
              }}
            >
              {tagline ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: taglineSize,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: taglineColor,
                    fontWeight: 600,
                    fontFamily,
                  }}
                >
                  {tagline}
                </p>
              ) : null}
              <h1
                style={{
                  margin: 0,
                  fontSize: titleSize,
                  lineHeight,
                  letterSpacing,
                  fontWeight,
                  fontFamily,
                  color: titleColor,
                }}
              >
                {block.title}
              </h1>
              {subtitle ? (
                <p
                  style={{
                    margin: 0,
                    maxWidth: block.fullWidth ? '100%' : 720,
                    fontSize: subtitleSize,
                    lineHeight: 1.5,
                    color: subtitleColor,
                    fontFamily,
                  }}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    );
  };

  function renderBlock(b: Block): React.ReactNode {
    switch (b.type) {
      case 'heading': {
        const Tag = b.level === 3 ? 'h3' : b.level === 2 ? 'h2' : 'h1';
        const align = b.align ?? 'left';
        return <Tag key={b.id} className={`mb-3 font-semibold text-${align} ${Tag==='h1'?'text-3xl':Tag==='h2'?'text-2xl':'text-xl'}`}>{b.text}</Tag>;
      }
      case 'text':
        return <p key={b.id} className={`mb-4 leading-7 text-${b.align ?? 'left'}`}>{b.text}</p>;
      case 'image': {
        const radius = b.radius === '2xl' ? 'rounded-2xl' : b.radius === 'lg' ? 'rounded-lg' : '';
        const style = `mb-4 ${radius} w-full`;
        return <img key={b.id} src={b.src} alt={b.alt ?? ''} className={style} style={b.width ? { maxWidth: b.width } : undefined} />;
      }
      case 'button': {
        const align = b.align ?? 'left';
        const base = b.style === 'outline'
          ? 'border border-emerald-600 text-emerald-700'
          : 'bg-emerald-600 text-white';
        return (
          <div key={b.id} className={`mb-4 flex ${align==='center'?'justify-center':align==='right'?'justify-end':'justify-start'}`}>
              <a href={b.href ?? '#'} target={b.target ?? '_self'} className={`px-4 py-2 rounded-xl ${base}`}>{b.label}</a>
          </div>
        );
      }
      case 'divider':
        return <hr key={b.id} className="my-6 border-neutral-200" />;
      case 'spacer':
        return <div key={b.id} style={{ height: (b.height ?? 24) }} />;
      case 'two-col': {
        const ratio = b.ratio ?? '1-1';
        const [l,r] = ratio === '1-2' ? ['1fr','2fr'] : ratio === '2-1' ? ['2fr','1fr'] : ['1fr','1fr'];
        return (
          <div key={b.id} className="grid gap-4 my-4" style={{ gridTemplateColumns: `${l} ${r}` }}>
            <div>{b.left?.map(renderBlock)}</div>
            <div>{b.right?.map(renderBlock)}</div>
          </div>
        );
      }
      case 'header':
        return renderHeaderBlock(b);
      default:
        return null;
    }
  }

  return <div>{blocks.map(renderBlock)}</div>;
}
