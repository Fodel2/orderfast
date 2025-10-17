import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Redo, Undo, X, ZoomIn, ZoomOut } from 'lucide-react';

import { tokens } from '@/src/ui/tokens';
import PageRenderer, { type Block, type DeviceKind } from '../PageRenderer';
import { useIsMobile } from '@/src/hooks/useIsMobile';

import DraggableBlock from './DraggableBlock';

const DEVICE_PREVIEW_WIDTHS: Record<DeviceKind, number> = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
};

const DEVICE_PREVIEW_HEIGHTS: Record<DeviceKind, number> = {
  mobile: 844,
  tablet: 1024,
  desktop: 800,
};

type WebpageBuilderProps = {
  blocks: Block[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onMoveBlock: (id: string, direction: -1 | 1) => void;
  onAddBlock: () => void;
  inspectorVisible?: boolean;
};

export default function WebpageBuilder({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveBlock,
  onAddBlock,
  inspectorVisible = false,
}: WebpageBuilderProps) {
  const [device, setDevice] = useState<DeviceKind>('desktop');
  const [zoom, setZoom] = useState(100);
  const isMobileViewport = useIsMobile(768);
  const toolbarTargetsRef = useRef<{
    blocks: HTMLButtonElement | null;
    undo: HTMLButtonElement | null;
    redo: HTMLButtonElement | null;
    save: HTMLButtonElement | null;
    close: HTMLButtonElement | null;
  }>({ blocks: null, undo: null, redo: null, save: null, close: null });
  const proxyObserverRef = useRef<MutationObserver | null>(null);
  const [toolbarReady, setToolbarReady] = useState(false);
  const [proxyToolbarState, setProxyToolbarState] = useState({
    blocksActive: false,
    undoDisabled: true,
    redoDisabled: true,
    saveDisabled: false,
    saveLabel: 'Save',
  });
  const deviceWidth = DEVICE_PREVIEW_WIDTHS[device] ?? DEVICE_PREVIEW_WIDTHS.desktop;
  const deviceHeight = DEVICE_PREVIEW_HEIGHTS[device] ?? DEVICE_PREVIEW_HEIGHTS.desktop;
  const shellStyle = useMemo<React.CSSProperties>(
    () => ({
      background: tokens.colors.canvas,
      fontFamily: tokens.fonts.sans,
      fontSize: tokens.fontSize.md,
      color: tokens.colors.textPrimary,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
    }),
    [],
  );
  const frameStyle = useMemo<React.CSSProperties>(
    () => ({
      width: '100%',
      borderRadius: tokens.radius.lg,
      boxShadow: tokens.shadow.lg,
      background: tokens.colors.surface,
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'relative',
      zIndex: 30,
    }),
    [],
  );

  const frameResponsiveStyle = useMemo<React.CSSProperties>(() => {
    if (!isMobileViewport) {
      return frameStyle;
    }

    return {
      ...frameStyle,
      width: `${deviceWidth}px`,
      minWidth: `${deviceWidth}px`,
      minHeight: `${deviceHeight}px`,
    };
  }, [deviceHeight, deviceWidth, frameStyle, isMobileViewport]);

  const previewScaleStyle = useMemo<React.CSSProperties>(
    () => {
      const base: React.CSSProperties = {
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        transform: `scale(${zoom / 100})`,
        transformOrigin: 'top center',
        transition: 'transform 0.25s ease',
      };

      if (!isMobileViewport) {
        return base;
      }

      return {
        ...base,
        minWidth: `${deviceWidth}px`,
        minHeight: `${deviceHeight}px`,
      };
    },
    [deviceHeight, deviceWidth, isMobileViewport, zoom],
  );

  const previewInnerStyle = useMemo<React.CSSProperties>(
    () => {
      const widthPx = `${deviceWidth}px`;
      const base: React.CSSProperties = {
        width: '100%',
        maxWidth: widthPx,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: tokens.spacing.lg,
        margin: '0 auto',
      };

      if (!isMobileViewport) {
        return base;
      }

      return {
        ...base,
        width: widthPx,
        maxWidth: widthPx,
        minWidth: widthPx,
        minHeight: `${deviceHeight}px`,
      };
    },
    [deviceHeight, deviceWidth, isMobileViewport],
  );

  const previewShellStyle = useMemo<React.CSSProperties>(
    () => ({
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      overflowX: isMobileViewport ? 'auto' : 'hidden',
      overflowY: isMobileViewport ? 'auto' : 'visible',
    }),
    [isMobileViewport],
  );

  const builderScrollStyle = useMemo<React.CSSProperties>(
    () => ({
      background: tokens.colors.canvas,
      minHeight: 0,
      overflowX: isMobileViewport ? 'auto' : 'hidden',
    }),
    [isMobileViewport],
  );

  const canvasStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.lg,
    minHeight: '100%',
    padding: tokens.spacing.lg,
    boxSizing: 'border-box',
  };

  const headerBlockId = useMemo(
    () => blocks.find((block) => block.type === 'header')?.id ?? null,
    [blocks],
  );

  const addButtonStyle: React.CSSProperties = {
    margin: `${tokens.spacing.lg}px auto 0`,
    display: 'block',
    padding: `${tokens.spacing.sm}px ${tokens.spacing.lg}px`,
    borderRadius: tokens.radius.lg,
    border: `${tokens.border.thin}px dashed ${tokens.colors.accent}`,
    background: tokens.colors.surface,
    color: tokens.colors.accent,
    fontWeight: tokens.fontWeight.medium,
    cursor: 'pointer',
    transition: `all 150ms ${tokens.easing.standard}`,
  };

  useEffect(() => {
    setZoom(100);
  }, [device]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let disposed = false;
    let rafId = 0;

    const updateFromDom = () => {
      if (disposed) return;
      const { blocks, undo, redo, save } = toolbarTargetsRef.current;
      setProxyToolbarState((previous) => ({
        ...previous,
        blocksActive: blocks?.getAttribute('aria-pressed') === 'true',
        undoDisabled: !!undo?.disabled,
        redoDisabled: !!redo?.disabled,
        saveDisabled: !!save?.disabled,
        saveLabel: save?.textContent?.trim() || 'Save',
      }));
    };

    const attachObservers = () => {
      proxyObserverRef.current?.disconnect();

      const observer = new MutationObserver(updateFromDom);
      const { blocks, undo, redo, save } = toolbarTargetsRef.current;
      [blocks, undo, redo, save].forEach((element) => {
        if (!element) return;
        observer.observe(element, {
          attributes: true,
          childList: true,
          subtree: true,
        });
      });
      proxyObserverRef.current = observer;
    };

    const assignTargets = () => {
      if (disposed) return;
      const container = document.querySelector<HTMLElement>('.wb-toolbar.flex:not(.wb-toolbar-proxy)');
      if (!container) {
        rafId = window.requestAnimationFrame(assignTargets);
        return;
      }

      const blocks = container.querySelector<HTMLButtonElement>('.blocks-btn');
      const undo = container.querySelector<HTMLButtonElement>('button[aria-label="Undo"]');
      const redo = container.querySelector<HTMLButtonElement>('button[aria-label="Redo"]');
      const save = container.querySelector<HTMLButtonElement>('.save-btn');
      const close = container.querySelector<HTMLButtonElement>('button[aria-label="Close builder"]');

      if (!blocks || !undo || !redo || !save || !close) {
        rafId = window.requestAnimationFrame(assignTargets);
        return;
      }

      toolbarTargetsRef.current = { blocks, undo, redo, save, close };
      setToolbarReady(true);
      updateFromDom();
      attachObservers();
    };

    assignTargets();

    return () => {
      disposed = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      proxyObserverRef.current?.disconnect();
      proxyObserverRef.current = null;
      toolbarTargetsRef.current = {
        blocks: null,
        undo: null,
        redo: null,
        save: null,
        close: null,
      };
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow || 'auto';
    };
  }, []);

  const adjustZoom = (delta: number) => {
    setZoom((previous) => {
      const next = Math.round(previous + delta);
      if (next < 50) return 50;
      if (next > 150) return 150;
      return next;
    });
  };

  const handleZoomOut = () => {
    adjustZoom(-10);
  };

  const handleZoomIn = () => {
    adjustZoom(10);
  };

  const zoomOutDisabled = zoom <= 50;
  const zoomInDisabled = zoom >= 150;

  const previewContent = (
    <div className="preview-inner" data-device={device} style={previewInnerStyle}>
      <div className="wb-canvas" style={frameResponsiveStyle}>
        <div style={canvasStyle}>
          {blocks.length === 0 && (
            <div
              style={{
                padding: tokens.spacing.lg,
                textAlign: 'center',
                color: tokens.colors.textMuted,
              }}
            >
              Click “Add block” to open the block library and start building your page.
            </div>
          )}
          {blocks.map((block, index) => {
            const headerId = headerBlockId;
            const isHeader = block.type === 'header';
            const disableMoveUp =
              isHeader ||
              index === 0 ||
              (headerId && headerId !== block.id && index === 1);
            const disableMoveDown = isHeader || index === blocks.length - 1;
            return (
              <DraggableBlock
                key={block.id}
                id={block.id}
                onDelete={() => onDeleteBlock(block.id)}
                onDuplicate={() => onDuplicateBlock(block.id)}
                onMoveUp={() => onMoveBlock(block.id, -1)}
                onMoveDown={() => onMoveBlock(block.id, 1)}
                disableMoveUp={disableMoveUp}
                disableMoveDown={disableMoveDown}
                isSelected={selectedBlockId === block.id}
                onSelect={() => onSelectBlock(block.id)}
              >
                <PageRenderer blocks={[block]} device={device} />
              </DraggableBlock>
            );
          })}
        </div>
      </div>
      <div className="add-block-row" data-add-block-row>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            onAddBlock();
          }}
          style={addButtonStyle}
          className="wb-add-cta"
        >
          + Add block
        </button>
      </div>
    </div>
  );

  const blocksPressed = toolbarReady && proxyToolbarState.blocksActive;
  const undoDisabled = !toolbarReady || proxyToolbarState.undoDisabled;
  const redoDisabled = !toolbarReady || proxyToolbarState.redoDisabled;
  const saveDisabled = !toolbarReady || proxyToolbarState.saveDisabled;
  const saveLabel = proxyToolbarState.saveLabel;

  const handleProxyClick = useCallback((key: keyof typeof toolbarTargetsRef.current) => {
    const target = toolbarTargetsRef.current[key];
    if (!target || (key === 'save' && target.disabled)) return;
    target.click();
  }, []);

  const handleBlocksToggle = useCallback(() => {
    handleProxyClick('blocks');
  }, [handleProxyClick]);

  const handleUndoProxy = useCallback(() => {
    if (undoDisabled) return;
    handleProxyClick('undo');
  }, [handleProxyClick, undoDisabled]);

  const handleRedoProxy = useCallback(() => {
    if (redoDisabled) return;
    handleProxyClick('redo');
  }, [handleProxyClick, redoDisabled]);

  const handleSaveProxy = useCallback(() => {
    if (saveDisabled) return;
    handleProxyClick('save');
  }, [handleProxyClick, saveDisabled]);

  const handleCloseProxy = useCallback(() => {
    handleProxyClick('close');
  }, [handleProxyClick]);

  return (
    <div
      className="builder-wrapper fixed inset-0 z-50 flex flex-col bg-background"
      style={shellStyle}
    >
      <div
        className="wb-toolbar wb-toolbar-proxy"
        style={{ zIndex: 9999 }}
      >
        <div className="website-toolbar">
          <div className="toolbar-left">
            <button
              type="button"
              onClick={handleBlocksToggle}
              aria-pressed={blocksPressed}
              disabled={!toolbarReady}
              className={`toolbar-btn blocks-btn${blocksPressed ? ' active' : ''}`}
            >
              Blocks
            </button>
            <button
              type="button"
              onClick={handleSaveProxy}
              disabled={saveDisabled}
              className="toolbar-btn save-btn"
            >
              {saveLabel}
            </button>
          </div>
          <div className="toolbar-center" aria-label="Preview device selector">
            <div className="toolbar-container">
              {(['mobile', 'tablet', 'desktop'] as DeviceKind[]).map((value) => {
                const isActive = device === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDevice(value)}
                    data-active={isActive}
                    className={`device-btn capitalize${isActive ? ' active' : ''}`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="toolbar-right">
            <button
              type="button"
              onClick={handleUndoProxy}
              aria-label="Undo"
              disabled={undoDisabled}
              className="toolbar-icon undo-btn"
            >
              <Undo size={16} />
            </button>
            <button
              type="button"
              onClick={handleRedoProxy}
              aria-label="Redo"
              disabled={redoDisabled}
              className="toolbar-icon redo-btn"
            >
              <Redo size={16} />
            </button>
            <div className="toolbar-zoom">
              <button
                type="button"
                onClick={handleZoomOut}
                aria-label="Zoom out"
                disabled={zoomOutDisabled}
                className="toolbar-icon zoom-out-btn"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(100)}
                aria-label="Reset zoom"
                data-active={zoom === 100}
                className={`toolbar-btn toolbar-zoom-level zoom-reset-btn${zoom === 100 ? ' active' : ''}`}
              >
                {zoom}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                aria-label="Zoom in"
                disabled={zoomInDisabled}
                className="toolbar-icon zoom-in-btn"
              >
                <ZoomIn size={16} />
              </button>
            </div>
            <button
              type="button"
              onClick={handleCloseProxy}
              aria-label="Close builder"
              disabled={!toolbarReady}
              className="toolbar-icon close-btn close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
      <div
        className="builder-scroll flex-1 overflow-y-auto overflow-x-hidden"
        style={builderScrollStyle}
      >
        <div className="builder-preview flex justify-center py-10">
          <div
            className="preview-shell"
            style={previewShellStyle}
          >
            <div className="preview-scale" style={previewScaleStyle}>
              {previewContent}
            </div>
          </div>
        </div>
      </div>
        <style jsx>{`
          .wb-toolbar-proxy {
            position: sticky;
            top: 0;
            width: 100%;
            padding: 12px 24px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(8px);
            box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08);
            border-bottom: 1px solid rgba(148, 163, 184, 0.18);
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .website-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            width: 100%;
            max-width: 1200px;
            position: relative;
            z-index: 10;
            flex-wrap: wrap;
          }

          .toolbar-left,
          .toolbar-center,
          .toolbar-right {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
          }

          .toolbar-center {
            flex: 1 1 auto;
            justify-content: center;
            overflow: visible;
          }

          .toolbar-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            max-width: 100%;
            overflow-x: auto;
            padding: 4px 12px;
            flex-wrap: nowrap;
            white-space: nowrap;
            -ms-overflow-style: none;
            scrollbar-width: none;
          }

          .toolbar-container::-webkit-scrollbar {
            display: none;
          }

          .toolbar-right {
            justify-content: flex-end;
          }

          .toolbar-center button {
            white-space: nowrap;
          }

          .toolbar-btn,
          .device-btn,
          .toolbar-icon {
            border-radius: 9999px;
            border: 1px solid rgba(148, 163, 184, 0.4);
            background: rgba(248, 249, 251, 0.95);
            color: rgba(15, 23, 42, 0.9);
            font-weight: 500;
            font-size: 14px;
            transition: all 0.18s ease;
            cursor: pointer;
            position: relative;
            z-index: 5;
            mix-blend-mode: normal;
          }

          .toolbar-btn {
            padding: 6px 16px;
            line-height: 1.2;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          }

          .device-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #f8f9fb;
            color: #111;
            border: 1px solid #ddd;
            border-radius: 9999px;
            padding: 6px 20px;
            font-size: 14px;
            font-weight: 500;
            white-space: nowrap;
            min-width: 70px;
            height: auto;
            line-height: 1.2;
          }

          .toolbar-icon {
            width: 34px;
            height: 34px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 6px;
            background: rgba(248, 249, 251, 0.92);
          }

          .toolbar-btn:hover,
          .device-btn:hover,
          .toolbar-icon:hover {
            background: var(--brand-highlight, rgba(224, 242, 254, 0.55));
            border-color: var(--brand-color, rgba(14, 165, 233, 0.8));
            color: var(--brand-color, #0ea5e9);
          }

          .toolbar-btn.active,
          .device-btn.active,
          .toolbar-btn[data-active='true'],
          .device-btn[data-active='true'] {
            background: var(--brand-color, #0ea5e9);
            border-color: var(--brand-color, #0ea5e9);
            color: #fff;
            font-weight: 600;
            box-shadow: 0 8px 20px rgba(14, 165, 233, 0.25);
          }

          .toolbar-btn:disabled,
          .device-btn:disabled,
          .toolbar-icon:disabled {
            cursor: not-allowed;
            opacity: 0.55;
            box-shadow: none;
          }

          .toolbar-icon.close {
            background: rgba(254, 242, 242, 0.95);
            border-color: rgba(248, 113, 113, 0.7);
            color: rgba(185, 28, 28, 0.9);
          }

          .toolbar-icon.close:hover {
            background: rgba(248, 113, 113, 1);
            border-color: rgba(220, 38, 38, 1);
            color: #fff;
          }

          .toolbar-zoom {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 8px;
            border-radius: 9999px;
            background: rgba(248, 249, 251, 0.7);
            border: 1px solid rgba(148, 163, 184, 0.3);
          }

          .toolbar-zoom-level {
            min-width: 64px;
          }

          @media (max-width: 1024px) {
            .website-toolbar {
              justify-content: center;
            }

            .toolbar-left,
            .toolbar-right {
              flex: 1 1 100%;
              justify-content: center;
            }

            .toolbar-right {
              order: 3;
            }
          }

          @media (max-width: 768px) {
            .toolbar-btn {
              padding: 6px 12px;
            }

            .device-btn {
              padding: 6px 16px;
              min-width: 64px;
            }

            .toolbar-icon {
              width: 32px;
              height: 32px;
            }
          }
        `}</style>
    </div>
  );
}
