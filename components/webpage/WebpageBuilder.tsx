import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import PageRenderer, { type Block, type DeviceKind } from '../PageRenderer';

import DraggableBlock from './DraggableBlock';
import GuardRailsOverlay, { type GuardEdge } from './GuardRailsOverlay';
import { tokens } from '@/src/ui/tokens';

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
  const deviceWidths: Record<DeviceKind, number> = {
    mobile: 375,
    tablet: 768,
    desktop: 1024,
  };

  const canvasWidth = deviceWidths[device];
  const frameRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  type GuardAlerts = Record<GuardEdge, boolean>;
  type GuardBounds = Record<GuardEdge, number>;

  const [guardAlerts, setGuardAlerts] = useState<GuardAlerts>({
    top: false,
    bottom: false,
    left: false,
    right: false,
  });
  const [guardBounds, setGuardBounds] = useState<GuardBounds>({
    top: 6,
    bottom: 94,
    left: 8,
    right: 92,
  });
  const [guardInfoHover, setGuardInfoHover] = useState(false);

  const updateGuardState = useCallback(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;

    const frameRect = frame.getBoundingClientRect();
    if (frameRect.width === 0 || frameRect.height === 0) {
      return;
    }

    const maxHorizontalInset = tokens.spacing.xl * 2.5;
    const maxVerticalInset = tokens.spacing.xl * 3;
    const horizontalInset = Math.min(frameRect.width * 0.08, maxHorizontalInset);
    const verticalInset = Math.min(frameRect.height * 0.08, maxVerticalInset);

    const safeLeft = frameRect.left + horizontalInset;
    const safeRight = frameRect.right - horizontalInset;
    const safeTop = frameRect.top + verticalInset;
    const safeBottom = frameRect.bottom - verticalInset;

    const nextAlerts: GuardAlerts = { top: false, bottom: false, left: false, right: false };
    const blockNodes = Array.from(
      content.querySelectorAll<HTMLElement>('[data-block-id]'),
    );

    if (blockNodes.length > 0) {
      const firstRect = blockNodes[0]!.getBoundingClientRect();
      const lastRect = blockNodes[blockNodes.length - 1]!.getBoundingClientRect();
      if (firstRect.top < safeTop - 1) nextAlerts.top = true;
      if (lastRect.bottom > safeBottom + 1) nextAlerts.bottom = true;

      blockNodes.forEach((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.left < safeLeft - 1) nextAlerts.left = true;
        if (rect.right > safeRight + 1) nextAlerts.right = true;
      });
    }

    setGuardAlerts((prev) => {
      if (
        prev.top === nextAlerts.top &&
        prev.bottom === nextAlerts.bottom &&
        prev.left === nextAlerts.left &&
        prev.right === nextAlerts.right
      ) {
        return prev;
      }
      return nextAlerts;
    });

    const topPercent = (verticalInset / frameRect.height) * 100;
    const leftPercent = (horizontalInset / frameRect.width) * 100;
    const computedBounds: GuardBounds = {
      top: Number.isFinite(topPercent) ? Math.max(0, Math.min(50, topPercent)) : 6,
      bottom: Number.isFinite(topPercent)
        ? Math.max(50, Math.min(100, 100 - topPercent))
        : 94,
      left: Number.isFinite(leftPercent) ? Math.max(0, Math.min(50, leftPercent)) : 8,
      right: Number.isFinite(leftPercent)
        ? Math.max(50, Math.min(100, 100 - leftPercent))
        : 92,
    };

    setGuardBounds((prev) => {
      if (
        prev.top === computedBounds.top &&
        prev.bottom === computedBounds.bottom &&
        prev.left === computedBounds.left &&
        prev.right === computedBounds.right
      ) {
        return prev;
      }
      return computedBounds;
    });
  }, []);

  useEffect(() => {
    updateGuardState();
  }, [blocks, device, inspectorVisible, updateGuardState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateGuardState();
    });
    observer.observe(frame);
    observer.observe(content);

    const handleResize = () => updateGuardState();
    window.addEventListener('resize', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [updateGuardState]);

  const deviceToggleStyle = useMemo<React.CSSProperties>(
    () => ({
      textTransform: 'capitalize',
      padding: `${tokens.spacing.xs}px ${tokens.spacing.md}px`,
      borderRadius: tokens.radius.lg,
      borderWidth: tokens.border.thin,
      borderStyle: 'solid',
      transition: `color 160ms ${tokens.easing.standard}, background-color 160ms ${tokens.easing.standard}, border-color 160ms ${tokens.easing.standard}`,
      fontSize: tokens.fontSize.sm,
      fontWeight: tokens.fontWeight.medium,
      cursor: 'pointer',
    }),
    []
  );

  const rootStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: tokens.colors.canvas,
    fontFamily: tokens.fonts.sans,
    fontSize: tokens.fontSize.md,
  };

  const scrollAreaStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    background: tokens.colors.surfaceSubtle,
  };

  const viewportStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
    boxSizing: 'border-box',
    transition: `padding 220ms ${tokens.easing.standard}`,
  };

  const frameStyle: React.CSSProperties = {
    width: `${canvasWidth}px`,
    maxWidth: `${canvasWidth}px`,
    flex: '0 0 auto',
    transition: `max-width 220ms ${tokens.easing.standard}`,
  };

  const canvasStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.md,
    minHeight: '100%',
  };

  const headerBlockId = useMemo(
    () => blocks.find((block) => block.type === 'header')?.id ?? null,
    [blocks],
  );

  const addButtonStyle: React.CSSProperties = {
    alignSelf: 'center',
    marginTop: blocks.length ? tokens.spacing.lg : 0,
    padding: `${tokens.spacing.sm}px ${tokens.spacing.lg}px`,
    borderRadius: tokens.radius.lg,
    border: `${tokens.border.thin}px dashed ${tokens.colors.accent}`,
    background: tokens.colors.surface,
    color: tokens.colors.accent,
    fontWeight: tokens.fontWeight.medium,
    cursor: 'pointer',
    transition: `all 150ms ${tokens.easing.standard}`,
  };

  const guardEdges: GuardEdge[] = ['top', 'right', 'bottom', 'left'];
  const hasGuardAlerts = guardEdges.some((edge) => guardAlerts[edge]);
  const tooltipEdge: GuardEdge = hasGuardAlerts
    ? guardEdges.find((edge) => guardAlerts[edge]) ?? 'top'
    : 'top';
  const tooltipVisible = hasGuardAlerts || guardInfoHover;

  return (
    <div style={rootStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: tokens.spacing.sm,
          padding: `${tokens.spacing.md}px ${tokens.spacing.xl}px`,
          borderBottom: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
          background: tokens.colors.surface,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
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
      <div style={scrollAreaStyle}>
        <div style={viewportStyle}>
          <div style={frameStyle}>
            <div
              ref={frameRef}
              style={{
                position: 'relative',
                background: tokens.colors.surface,
                borderRadius: tokens.radius.lg,
                padding: tokens.spacing.lg,
                boxShadow: tokens.shadow.sm,
                transition: `box-shadow 200ms ${tokens.easing.standard}`,
              }}
            >
              <GuardRailsOverlay
                bounds={guardBounds}
                alerts={guardAlerts}
                visible
                tooltip={{
                  visible: tooltipVisible,
                  edge: tooltipEdge,
                  message: 'Keeping within the guide lines ensures visibility on all devices.',
                }}
                onInfoHoverChange={setGuardInfoHover}
              />
              <div ref={contentRef} style={canvasStyle}>
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
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button type="button" onClick={onAddBlock} style={addButtonStyle}>
                  + Add block
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
