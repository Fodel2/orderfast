import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  BLOCK_INTERACTION_GLOBAL_STYLES,
  DEVICE_DIMENSIONS,
  getBlockBackgroundPresentation,
  getBlockChromeStyle,
  getBlockInteractionPresentation,
  isTextualBlockKind,
  resolveBlockVisibility,
  type DeviceKind,
  type SlideBlock,
  type SlideCfg,
} from './SlidesManager';
import type { SlideRow } from '@/components/customer/home/SlidesContainer';
import {
  DEFAULT_TEXT_FONT_FAMILY,
  resolveBlockFontFamily,
  useGoogleFontLoader,
} from '@/lib/slideFonts';
import { tokens } from '../src/ui/tokens';
import { renderStaticBlock } from './slides/staticRenderer';
import { resolveTypographySpacing } from '@/src/utils/typography';
import { resolveBlockLayout } from '@/src/utils/resolveBlockLayout';

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


function Background({ cfg }: { cfg: SlideCfg }) {
  const bg = cfg.background;
  if (!bg) return null;
  if (bg.type === 'color') {
    return (
      <>
        <div
          className="of-canvas-bg absolute inset-0"
          style={{ background: bg.color || tokens.colors.surfaceInverse, pointerEvents: 'none' }}
        />
        {bg.overlay && (
          <div
            className="of-canvas-bg absolute inset-0"
            style={{
              background: bg.overlay.color || tokens.colors.overlay.strong,
              opacity: bg.overlay.opacity ?? tokens.opacity[50],
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
          className="of-canvas-bg absolute inset-0"
          style={{
            backgroundImage: bg.url ? `url(${bg.url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            pointerEvents: 'none',
          }}
        />
        {bg.overlay && (
          <div
            className="of-canvas-bg absolute inset-0"
            style={{
              background: bg.overlay.color || tokens.colors.overlay.strong,
              opacity: bg.overlay.opacity ?? tokens.opacity[50],
              pointerEvents: 'none',
            }}
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
          className="of-canvas-bg absolute inset-0 h-full w-full object-cover"
        />
        {bg.overlay && (
          <div
            className="of-canvas-bg absolute inset-0"
            style={{
              background: bg.overlay.color || tokens.colors.overlay.strong,
              opacity: bg.overlay.opacity ?? tokens.opacity[50],
              pointerEvents: 'none',
            }}
          />
        )}
      </>
    );
  }
  return null;
}

export default function SlidesSection({ slide, cfg }: { slide: SlideRow; cfg: SlideCfg }) {
  const device = useDeviceKind();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>(() => ({
    width: DEVICE_DIMENSIONS.desktop.width,
    height: DEVICE_DIMENSIONS.desktop.height,
  }));
  const fontsInUse = useMemo(() => {
    const set = new Set<string>();
    (cfg.blocks || []).forEach((block) => {
      set.add(resolveBlockFontFamily(block));
    });
    if (set.size === 0) {
      set.add(DEFAULT_TEXT_FONT_FAMILY);
    }
    return Array.from(set);
  }, [cfg.blocks]);

  useGoogleFontLoader(fontsInUse);

  const blocks = useMemo(() => cfg.blocks || [], [cfg.blocks]);

  useEffect(() => {
    const node = canvasRef.current;
    if (!node) {
      if (typeof window !== 'undefined') {
        setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
      }
      return;
    }

    if (typeof window !== 'undefined' && typeof ResizeObserver === 'undefined') {
      const updateFromWindow = () => {
        setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
      };
      updateFromWindow();
      window.addEventListener('resize', updateFromWindow);
      return () => {
        window.removeEventListener('resize', updateFromWindow);
      };
    }

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width, height });
      }
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [device]);

  const effectiveCanvasSize =
    canvasSize.width > 0 && canvasSize.height > 0 ? canvasSize : DEVICE_DIMENSIONS.desktop;

  return (
    <>
      <style jsx global>{BLOCK_INTERACTION_GLOBAL_STYLES}</style>
      <section className="of-canvas relative flex snap-start items-center justify-center overflow-hidden">
        <Background cfg={cfg} />
        <div ref={canvasRef} className="relative h-full w-full" style={{ pointerEvents: 'none' }}>
          {blocks.map((block, index) => {
            const visibility = resolveBlockVisibility(block);
            if (!visibility[device]) {
              return null;
            }
            const frame = pickFrame(block, device);
            const layout = resolveBlockLayout(
              {
                xPct: frame.x,
                yPct: frame.y,
                wPct: frame.w,
                hPct: frame.h,
                rotationDeg: frame.r ?? 0,
              },
              device,
              index,
              effectiveCanvasSize,
            );
            const style: CSSProperties = {
              position: 'absolute',
              left: layout.left,
              top: layout.top,
              width: layout.width,
              height: layout.height,
              transform: `rotate(${layout.rotation}deg)`,
              transformOrigin: 'top left',
              pointerEvents: 'auto',
              zIndex: layout.zIndex,
            };
            const interaction = getBlockInteractionPresentation(block);
            const backgroundPresentation = getBlockBackgroundPresentation(block.background);
            const chromeStyle = {
              ...getBlockChromeStyle(block, backgroundPresentation),
              ...(interaction.style || {}),
            } as CSSProperties;
            const textual = isTextualBlockKind(block.kind);
            const typography = textual ? resolveTypographySpacing(block) : undefined;
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

            return (
              <div key={block.id} style={style} data-slide-block-id={block.id}>
                <div style={chromeStyle} className={chromeClasses.join(' ')}>
                  {backgroundPresentation && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={backgroundPresentation.style}
                    />
                  )}
                  <div className={wrapperClasses.join(' ')}>
                    {renderStaticBlock(
                      block,
                      typography ? { typography } : undefined,
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

