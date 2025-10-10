import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Redo2, Undo2, X } from 'lucide-react';

import PageRenderer, { type Block, type DeviceKind } from '../PageRenderer';

import DraggableBlock from './DraggableBlock';
import { AdminButton } from '../ui/AdminButton';
import MobileInspector from '../inspector/MobileInspector';
import SidebarInspector from '../inspector/SideInspector';
import { tokens } from '@/src/ui/tokens';

const DEVICE_PREVIEW_WIDTHS: Record<DeviceKind, number> = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
};

const formatBlockTitle = (block: Block) =>
  block.type
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

type WebpageBuilderProps = {
  blocks: Block[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
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
  const [view, setView] = useState<DeviceKind>('desktop');
  const [zoom, setZoom] = useState(100);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [isMobileView, setIsMobileView] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 900;
  });
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
      maxWidth: view === 'desktop' ? 1280 : DEVICE_PREVIEW_WIDTHS[view],
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: tokens.spacing.lg,
      margin: '0 auto',
    }),
    [view],
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
  }, [view]);

  useEffect(() => {
    if (!selectedBlockId) {
      setSelectedBlock(null);
      return;
    }

    const block = blocks.find((item) => item.id === selectedBlockId) ?? null;
    setSelectedBlock(block);
  }, [blocks, selectedBlockId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 900);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

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

  const adjustZoom = useCallback((delta: number) => {
    setZoom((previous) => {
      const next = Math.round(previous + delta);
      if (next < 50) return 50;
      if (next > 150) return 150;
      return next;
    });
  }, []);

  const zoomOut = useCallback(() => {
    adjustZoom(-10);
  }, [adjustZoom]);

  const zoomIn = useCallback(() => {
    adjustZoom(10);
  }, [adjustZoom]);

  const resetZoom = useCallback(() => {
    setZoom(100);
  }, []);

  const zoomOutDisabled = zoom <= 50;
  const zoomInDisabled = zoom >= 150;

  const handleBlockSelect = useCallback(
    (block: Block) => {
      setSelectedBlock(block);
      onSelectBlock(block.id);
    },
    [onSelectBlock],
  );

  const closeInspector = useCallback(() => {
    setSelectedBlock(null);
    onSelectBlock(null);
  }, [onSelectBlock]);

  const inspectorEmptyState = useMemo(
    () => (
      <div className="text-sm text-neutral-500">Select a block to edit its properties.</div>
    ),
    [],
  );

  const inspectorContent = useMemo(() => {
    if (!selectedBlock) {
      return inspectorEmptyState;
    }

    const blockTitle = formatBlockTitle(selectedBlock);

    switch (selectedBlock.type) {
      case 'text':
        return (
          <div className="space-y-4 text-sm text-neutral-600">
            <div>
              <div className="text-xs font-semibold uppercase text-neutral-500">Block</div>
              <div className="mt-1 font-medium text-neutral-800">{blockTitle}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-neutral-500">Content</div>
              <p className="mt-2 whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-neutral-700 shadow-sm">
                {selectedBlock.text.trim().length ? selectedBlock.text : 'Add copy to this text block to tell your story.'}
              </p>
            </div>
            <div className="text-xs text-neutral-500">
              Alignment:{' '}
              <span className="font-medium text-neutral-700">{selectedBlock.align ?? 'left'}</span>
            </div>
          </div>
        );
      case 'image':
        return (
          <div className="space-y-4 text-sm text-neutral-600">
            <div>
              <div className="text-xs font-semibold uppercase text-neutral-500">Block</div>
              <div className="mt-1 font-medium text-neutral-800">{blockTitle}</div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-neutral-800">Source</span>
                <span className="break-all text-xs text-neutral-500">{selectedBlock.src}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-neutral-500">
                <span>
                  Alt text:{' '}
                  <span className="font-medium text-neutral-700">{selectedBlock.alt ?? '—'}</span>
                </span>
                <span>
                  Width:{' '}
                  <span className="font-medium text-neutral-700">{selectedBlock.width ?? 960}px</span>
                </span>
                <span>
                  Radius:{' '}
                  <span className="font-medium text-neutral-700">{selectedBlock.radius ?? 'lg'}</span>
                </span>
              </div>
            </div>
          </div>
        );
      case 'button':
        return (
          <div className="space-y-4 text-sm text-neutral-600">
            <div>
              <div className="text-xs font-semibold uppercase text-neutral-500">Block</div>
              <div className="mt-1 font-medium text-neutral-800">{blockTitle}</div>
            </div>
            <dl className="space-y-2 text-xs text-neutral-500">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                <dt className="font-medium text-neutral-600">Label</dt>
                <dd className="font-medium text-neutral-800">{selectedBlock.label}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                <dt className="font-medium text-neutral-600">Link</dt>
                <dd className="font-medium text-neutral-800">{selectedBlock.href ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                <dt className="font-medium text-neutral-600">Style</dt>
                <dd className="font-medium text-neutral-800">{selectedBlock.style ?? 'primary'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                <dt className="font-medium text-neutral-600">Alignment</dt>
                <dd className="font-medium text-neutral-800">{selectedBlock.align ?? 'left'}</dd>
              </div>
            </dl>
          </div>
        );
      case 'spacer':
        return (
          <div className="space-y-4 text-sm text-neutral-600">
            <div>
              <div className="text-xs font-semibold uppercase text-neutral-500">Block</div>
              <div className="mt-1 font-medium text-neutral-800">{blockTitle}</div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
              <span>Height: </span>
              <span className="font-medium text-neutral-800">{selectedBlock.height ?? 24}px</span>
            </div>
          </div>
        );
      case 'divider':
        return (
          <div className="space-y-4 text-sm text-neutral-600">
            <div>
              <div className="text-xs font-semibold uppercase text-neutral-500">Block</div>
              <div className="mt-1 font-medium text-neutral-800">{blockTitle}</div>
            </div>
            <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
              This divider keeps sections tidy. Drag it to reposition or replace it with another spacer.
            </div>
          </div>
        );
      case 'two-col':
        return (
          <div className="space-y-4 text-sm text-neutral-600">
            <div>
              <div className="text-xs font-semibold uppercase text-neutral-500">Block</div>
              <div className="mt-1 font-medium text-neutral-800">{blockTitle}</div>
            </div>
            <div className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
              <div className="font-semibold text-neutral-700">Left column</div>
              <div className="rounded-lg border border-neutral-200 bg-white p-2 text-xs text-neutral-500">
                {selectedBlock.left.text?.text?.trim().length
                  ? selectedBlock.left.text.text
                  : 'Add text or imagery to balance your layout.'}
              </div>
              <div className="font-semibold text-neutral-700">Right column</div>
              <div className="rounded-lg border border-neutral-200 bg-white p-2 text-xs text-neutral-500">
                {selectedBlock.right.text?.text?.trim().length
                  ? selectedBlock.right.text.text
                  : 'Use this space for supporting content or visuals.'}
              </div>
            </div>
            <div className="text-xs text-neutral-500">
              Ratio:{' '}
              <span className="font-medium text-neutral-700">{selectedBlock.ratio ?? '1-1'}</span>
            </div>
          </div>
        );
      case 'header':
        return (
          <div className="space-y-4 text-sm text-neutral-600">
            <div>
              <div className="text-xs font-semibold uppercase text-neutral-500">Block</div>
              <div className="mt-1 font-medium text-neutral-800">{blockTitle}</div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-neutral-600">
              <div className="font-semibold text-neutral-800">{selectedBlock.title}</div>
              {selectedBlock.subtitle ? (
                <p className="mt-2 text-xs text-neutral-500">{selectedBlock.subtitle}</p>
              ) : null}
              {selectedBlock.tagline ? (
                <p className="mt-2 text-xs uppercase tracking-wide text-neutral-400">{selectedBlock.tagline}</p>
              ) : null}
              <p className="mt-3 text-xs text-neutral-500">
                Header imagery and typography controls live in the advanced inspector. Use the desktop sidebar for the full
                toolset.
              </p>
            </div>
          </div>
        );
      default:
        return inspectorEmptyState;
    }
  }, [inspectorEmptyState, selectedBlock]);

  const inspectorSubtitle = useMemo(
    () =>
      selectedBlock
        ? `Editing ${selectedBlock.type.replace(/-/g, ' ')}`
        : 'Select a block to edit',
    [selectedBlock],
  );

  const inspectorOpen = inspectorVisible && Boolean(selectedBlock);

  const inspectorNode = isMobileView ? (
    <MobileInspector
      key="mobile-inspector"
      className="wb-inspector wb-inspector--mobile md:hidden"
      open={inspectorOpen}
      subtitle={inspectorSubtitle}
      onClose={closeInspector}
      renderContent={() => inspectorContent}
    />
  ) : (
    <SidebarInspector
      key="desktop-inspector"
      className="hidden md:flex wb-inspector wb-inspector--desktop"
      open={inspectorOpen}
      selectedBlock={selectedBlock}
      subtitle={inspectorSubtitle}
      onClose={closeInspector}
      renderContent={() => inspectorContent}
      emptyState={inspectorEmptyState}
    />
  );

  const previewContent = (
    <div className="preview-inner" data-device={view} style={previewInnerStyle}>
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
                onSelect={() => handleBlockSelect(block)}
              >
                <PageRenderer blocks={[block]} device={view} />
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
        className="wb-toolbar wb-toolbar-proxy sticky top-0 z-50 flex items-center justify-between px-4 py-2 bg-white backdrop-blur-md border-b border-neutral-200 shadow-sm"
        style={{ zIndex: 9999 }}
      >
        <div className="wb-toolbar-inner">
          <div className="wb-left flex items-center gap-2">
            <AdminButton
              type="button"
              onClick={handleBlocksToggle}
              aria-pressed={blocksPressed}
              disabled={!toolbarReady}
              variant="primary"
              active={blocksPressed}
              className="blocks-btn"
            >
              Blocks
            </AdminButton>
            <AdminButton
              type="button"
              onClick={handleUndoProxy}
              aria-label="Undo"
              disabled={undoDisabled}
              variant="outline"
              className="undo-btn !px-3"
            >
              <Undo2 size={16} />
            </AdminButton>
            <AdminButton
              type="button"
              onClick={handleRedoProxy}
              aria-label="Redo"
              disabled={redoDisabled}
              variant="outline"
              className="redo-btn !px-3"
            >
              <Redo2 size={16} />
            </AdminButton>
            <AdminButton
              type="button"
              onClick={handleSaveProxy}
              disabled={saveDisabled}
              variant="primary"
              className="save-btn"
            >
              {saveLabel}
            </AdminButton>
          </div>
          <div className="wb-center flex items-center justify-center mt-2" aria-hidden="true" />
          <div className="wb-right flex items-center gap-2">
            <AdminButton
              type="button"
              onClick={handleCloseProxy}
              aria-label="Close builder"
              disabled={!toolbarReady}
              variant="outline"
              className="close-btn !px-3"
            >
              <X size={16} />
            </AdminButton>
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
            <div className="wb-device-bar" role="toolbar" aria-label="Device & zoom">
              <div className="wb-device-group">
                <button
                  type="button"
                  className={`wb-pill ${view === 'mobile' ? 'is-active' : ''}`}
                  onClick={() => setView('mobile')}
                  aria-pressed={view === 'mobile'}
                >
                  Mobile
                </button>
                <button
                  type="button"
                  className={`wb-pill ${view === 'tablet' ? 'is-active' : ''}`}
                  onClick={() => setView('tablet')}
                  aria-pressed={view === 'tablet'}
                >
                  Tablet
                </button>
                <button
                  type="button"
                  className={`wb-pill ${view === 'desktop' ? 'is-active' : ''}`}
                  onClick={() => setView('desktop')}
                  aria-pressed={view === 'desktop'}
                >
                  Desktop
                </button>
              </div>
              <div className="wb-zoom-group">
                <button
                  type="button"
                  className="wb-icon-btn"
                  onClick={zoomOut}
                  disabled={zoomOutDisabled}
                  aria-label="Zoom out"
                >
                  –
                </button>
                <span
                  role="button"
                  tabIndex={0}
                  className="wb-zoom-label"
                  onClick={resetZoom}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      resetZoom();
                    }
                  }}
                >
                  {zoom}%
                </span>
                <button
                  type="button"
                  className="wb-icon-btn"
                  onClick={zoomIn}
                  disabled={zoomInDisabled}
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
            </div>
            <div className="preview-scale" style={previewScaleStyle}>
              {previewContent}
            </div>
          </div>
        </div>
      </div>
      {inspectorNode}
    </div>
  );
}
