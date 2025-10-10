import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Redo2, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react';

import PageRenderer, { type Block, type DeviceKind } from '../PageRenderer';

import DraggableBlock from './DraggableBlock';
import { tokens } from '@/src/ui/tokens';

const DEVICE_PREVIEW_WIDTHS: Record<DeviceKind, number> = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
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
  const deviceToggleStyle = useMemo<React.CSSProperties>(
    () => ({
      textTransform: 'capitalize',
      padding: '0 10px',
      borderRadius: tokens.radius.lg,
      borderWidth: tokens.border.thin,
      borderStyle: 'solid',
      transition: `color 160ms ${tokens.easing.standard}, background-color 160ms ${tokens.easing.standard}, border-color 160ms ${tokens.easing.standard}`,
      fontSize: 12,
      fontWeight: tokens.fontWeight.medium,
      height: 28,
      cursor: 'pointer',
    }),
    []
  );

  const toolbarButtonBase = useMemo<React.CSSProperties>(
    () => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 32,
      borderRadius: tokens.radius.lg,
      border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
      background: tokens.colors.surface,
      color: tokens.colors.textSecondary,
      transition: `color 160ms ${tokens.easing.standard}, background-color 160ms ${tokens.easing.standard}, border-color 160ms ${tokens.easing.standard}`,
      cursor: 'pointer',
      fontFamily: tokens.fonts.sans,
    }),
    [],
  );

  const iconButtonStyle = useMemo<React.CSSProperties>(
    () => ({
      ...toolbarButtonBase,
      width: 32,
      padding: 0,
    }),
    [toolbarButtonBase],
  );

  const textButtonStyle = useMemo<React.CSSProperties>(
    () => ({
      ...toolbarButtonBase,
      padding: `0 ${tokens.spacing.sm}px`,
      fontSize: tokens.fontSize.sm,
      fontWeight: tokens.fontWeight.medium,
      gap: tokens.spacing.xs,
    }),
    [toolbarButtonBase],
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

  const previewScaleStyle = useMemo<React.CSSProperties>(
    () => ({
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      transform: `scale(${zoom / 100})`,
      transformOrigin: 'top center',
      transition: 'transform 0.25s ease',
    }),
    [zoom],
  );

  const previewInnerStyle = useMemo<React.CSSProperties>(
    () => ({
      width: '100%',
      maxWidth: device === 'desktop' ? 1280 : DEVICE_PREVIEW_WIDTHS[device],
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: tokens.spacing.lg,
      margin: '0 auto',
    }),
    [device]);

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
      const container = document.querySelector<HTMLElement>('.wb-toolbar.flex');
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
      <div className="wb-canvas" style={frameStyle}>
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
      <div className="wb-toolbar">
        <div className="wb-toolbar-inner">
          <div className="wb-left">
            <button
              type="button"
              onClick={handleBlocksToggle}
              aria-pressed={blocksPressed}
              disabled={!toolbarReady}
              style={{
                ...textButtonStyle,
                borderColor: blocksPressed ? tokens.colors.accent : tokens.colors.borderLight,
                background: blocksPressed ? tokens.colors.surfaceSubtle : tokens.colors.surface,
                color: blocksPressed ? tokens.colors.accent : tokens.colors.textSecondary,
                boxShadow: blocksPressed ? tokens.shadow.sm : 'none',
                cursor: toolbarReady ? 'pointer' : 'not-allowed',
                opacity: toolbarReady ? 1 : 0.6,
              }}
            >
              Blocks
            </button>
            <button
              type="button"
              onClick={handleUndoProxy}
              aria-label="Undo"
              disabled={undoDisabled}
              style={{
                ...iconButtonStyle,
                opacity: undoDisabled ? 0.5 : 1,
                cursor: undoDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              onClick={handleRedoProxy}
              aria-label="Redo"
              disabled={redoDisabled}
              style={{
                ...iconButtonStyle,
                opacity: redoDisabled ? 0.5 : 1,
                cursor: redoDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              <Redo2 size={16} />
            </button>
            <button
              type="button"
              onClick={handleSaveProxy}
              disabled={saveDisabled}
              style={{
                ...textButtonStyle,
                background: saveDisabled ? tokens.colors.surface : tokens.colors.accent,
                color: saveDisabled ? tokens.colors.textSecondary : tokens.colors.textOnDark,
                borderColor: saveDisabled ? tokens.colors.borderLight : tokens.colors.accent,
                cursor: saveDisabled ? 'not-allowed' : 'pointer',
                opacity: saveDisabled ? 0.7 : 1,
              }}
            >
              {saveLabel}
            </button>
          </div>
          <div className="wb-center" aria-label="Preview device selector">
            {(['mobile', 'tablet', 'desktop'] as DeviceKind[]).map((value) => {
              const isActive = device === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDevice(value)}
                  style={{
                    ...deviceToggleStyle,
                    borderColor: isActive ? tokens.colors.accent : tokens.colors.borderLight,
                    background: isActive ? tokens.colors.surfaceSubtle : tokens.colors.surface,
                    color: isActive ? tokens.colors.accent : tokens.colors.textSecondary,
                    boxShadow: isActive ? tokens.shadow.sm : 'none',
                  }}
                >
                  {value}
                </button>
              );
            })}
          </div>
          <div className="wb-right">
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Zoom out"
              disabled={zoomOutDisabled}
              style={{
                ...iconButtonStyle,
                opacity: zoomOutDisabled ? 0.5 : 1,
                cursor: zoomOutDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              <ZoomOut size={16} />
            </button>
            <span className="wb-zoom-readout">{zoom}%</span>
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Zoom in"
              disabled={zoomInDisabled}
              style={{
                ...iconButtonStyle,
                opacity: zoomInDisabled ? 0.5 : 1,
                cursor: zoomInDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={handleCloseProxy}
              aria-label="Close builder"
              disabled={!toolbarReady}
              style={{
                ...iconButtonStyle,
                opacity: toolbarReady ? 1 : 0.6,
                cursor: toolbarReady ? 'pointer' : 'not-allowed',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
      <div
        className="builder-scroll flex-1 overflow-y-auto overflow-x-hidden"
        style={{
          background: tokens.colors.canvas,
          minHeight: 0,
        }}
      >
        <div className="builder-preview flex justify-center py-10">
          <div
            className="preview-shell"
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div className="preview-scale" style={previewScaleStyle}>
              {previewContent}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
