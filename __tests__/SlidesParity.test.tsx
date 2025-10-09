import React from 'react';
import { cleanup, render } from '@testing-library/react';
import SlidesSection from '@/components/SlidesSection';
import { renderStaticBlock } from '@/components/slides/staticRenderer';
import {
  DEVICE_DIMENSIONS,
  getBlockBackgroundPresentation,
  getBlockChromeStyle,
  getBlockInteractionPresentation,
  isTextualBlockKind,
  type SlideBlock,
  type SlideCfg,
  type DeviceKind,
} from '@/components/SlidesManager';
import type { SlideRow } from '@/components/customer/home/SlidesContainer';
import { tokens } from '@/src/ui/tokens';
import { resolveBlockLayout } from '@/src/utils/resolveBlockLayout';

afterEach(() => {
  cleanup();
});

const defaultFrame = { x: 10, y: 10, w: 40, h: 20, r: 0 } as const;

const pickFrame = (block: SlideBlock, device: DeviceKind) => {
  const frames = block.frames || {};
  return (
    frames[device] ||
    frames.desktop ||
    frames.tablet ||
    frames.mobile || { ...defaultFrame }
  );
};

const baseSlide: SlideRow = {
  id: 'slide',
  restaurant_id: 'test',
  type: 'custom',
  title: null,
  subtitle: null,
  media_url: null,
  cta_label: null,
  cta_href: null,
  visible_from: null,
  visible_until: null,
  is_active: true,
  sort_order: 0,
  config_json: {},
};

const createBlock = (partial: Partial<SlideBlock>): SlideBlock => ({
  id: `block-${partial.kind ?? 'text'}`,
  kind: 'text',
  text: 'Sample copy',
  frames: { desktop: { ...defaultFrame } },
  config: {},
  ...partial,
});

const builderWrapper = (block: SlideBlock) => {
  const backgroundPresentation = getBlockBackgroundPresentation(block.background);
  const interaction = getBlockInteractionPresentation(block);
  const chromeStyle = {
    ...getBlockChromeStyle(block, backgroundPresentation),
    ...(interaction.style || {}),
  };
  const textual = isTextualBlockKind(block.kind);
  const chromeClasses = ['relative'];
  if (textual) {
    chromeClasses.push('inline-flex', 'max-w-full');
  } else {
    chromeClasses.push('h-full', 'w-full');
  }
  if (interaction.classNames && interaction.classNames.length > 0) {
    chromeClasses.push(...interaction.classNames);
  }
  const wrapperClasses = ['block-wrapper'];
  if (textual) {
    wrapperClasses.push('inline-flex', 'max-w-full');
  } else {
    wrapperClasses.push('flex', 'h-full', 'w-full');
  }
  const frame = pickFrame(block, 'desktop');
  const canvasWidth =
    typeof window !== 'undefined' && typeof window.innerWidth === 'number'
      ? window.innerWidth
      : DEVICE_DIMENSIONS.desktop.width;
  const canvasHeight =
    typeof window !== 'undefined' && typeof window.innerHeight === 'number'
      ? window.innerHeight
      : DEVICE_DIMENSIONS.desktop.height;
  const layout = resolveBlockLayout(
    {
      xPct: frame.x,
      yPct: frame.y,
      wPct: frame.w,
      hPct: frame.h,
      rotationDeg: frame.r ?? 0,
    },
    'desktop',
    0,
    { width: canvasWidth, height: canvasHeight },
  );
  const style = {
    position: 'absolute' as const,
    left: layout.left,
    top: layout.top,
    width: layout.width,
    height: layout.height,
    transform: `rotate(${layout.rotation}deg)`,
    transformOrigin: 'top left',
    pointerEvents: 'auto',
    zIndex: layout.zIndex,
  };
  return (
    <div style={style} data-slide-block-id={block.id}>
      <div className={chromeClasses.join(' ')} style={chromeStyle}>
        {backgroundPresentation && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={backgroundPresentation.style}
          />
        )}
        <div className={wrapperClasses.join(' ')}>{renderStaticBlock(block)}</div>
      </div>
    </div>
  );
};

const parityCases: Array<{ name: string; block: SlideBlock }> = [
  {
    name: 'heading block',
    block: createBlock({
      id: 'heading-block',
      kind: 'heading',
      text: 'Cedar & Sage Bistro',
      size: 'lg',
      color: tokens.colors.textOnDark,
      fontWeight: tokens.fontWeight.bold,
    }),
  },
  {
    name: 'subheading block',
    block: createBlock({
      id: 'subheading-block',
      kind: 'subheading',
      text: 'Weekend brunch menu',
      size: 'md',
      textColor: tokens.colors.textPrimary,
    }),
  },
  {
    name: 'text block with background',
    block: createBlock({
      id: 'text-block',
      kind: 'text',
      text: 'Reserve a table to enjoy seasonal dishes and handcrafted cocktails.',
      bgStyle: 'glass',
      bgColor: tokens.colors.surfaceInverse,
      bgOpacity: 0.35,
      padding: tokens.spacing.sm,
    }),
  },
  {
    name: 'button block',
    block: createBlock({
      id: 'button-block',
      kind: 'button',
      text: 'Book now',
      align: 'center',
      config: { href: '/reserve', variant: 'Primary', radius: tokens.radius.md },
    }),
  },
  {
    name: 'quote block',
    block: createBlock({
      id: 'quote-block',
      kind: 'quote',
      config: {
        text: 'The ambience and service were impeccable.',
        author: 'Avery L.',
        style: 'card',
        starColor: 'brandPrimary',
        bgColor: tokens.colors.surface,
      },
    }),
  },
  {
    name: 'image block',
    block: createBlock({
      id: 'image-block',
      kind: 'image',
      src: 'https://example.com/image.jpg',
      config: { url: 'https://example.com/image.jpg', fit: 'cover', radius: tokens.radius.md },
    }),
  },
  {
    name: 'gallery block',
    block: createBlock({
      id: 'gallery-block',
      kind: 'gallery',
      config: {
        items: [
          { url: 'https://example.com/one.jpg' },
          { url: 'https://example.com/two.jpg' },
        ],
        layout: 'grid',
        radius: tokens.radius.sm,
      },
    }),
  },
];

describe('Slides renderer parity', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  });

  parityCases.forEach(({ name, block }) => {
    it(`matches builder markup for ${name}`, () => {
      const cfg: SlideCfg = {
        background: { type: 'color', color: tokens.colors.surfaceInverse },
        blocks: [block],
      };

      const { container: liveContainer } = render(
        <SlidesSection slide={baseSlide} cfg={cfg} />,
      );
      const liveNode = liveContainer.querySelector(`[data-slide-block-id="${block.id}"]`);
      expect(liveNode).not.toBeNull();

      const { container: builderContainer } = render(builderWrapper(block));
      const builderNode = builderContainer.querySelector(`[data-slide-block-id="${block.id}"]`);
      expect(builderNode).not.toBeNull();

      expect(builderNode?.isEqualNode(liveNode ?? null)).toBe(true);
    });
  });
});
