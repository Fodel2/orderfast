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
  type SafeZoneInsets = { top: number; bottom: number; left: number; right: number };

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
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [safeZoneInsets, setSafeZoneInsets] = useState<SafeZoneInsets>({
    top: tokens.spacing.lg,
    bottom: tokens.spacing.lg,
    left: tokens.spacing.lg,
    right: tokens.spacing.lg,
  });

  useEffect(() => {
    if (!showGuidelines) {
      setGuardInfoHover(false);
    }
  }, [showGuidelines]);

  const updateGuardState = useCallback(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;

    const frameRect = frame.getBoundingClientRect();
    if (frameRect.width === 0 || frameRect.height === 0) {
      return;
    }

    const computed = typeof window !== 'undefined' ? window.getComputedStyle(frame) : null;
    const framePaddingLeft = computed ? parseFloat(computed.paddingLeft) || 0 : 0;
    const framePaddingRight = computed ? parseFloat(computed.paddingRight) || 0 : 0;
    const framePaddingTop = computed ? parseFloat(computed.paddingTop) || 0 : 0;
    const framePaddingBottom = computed ? parseFloat(computed.paddingBottom) || 0 : 0;

    const maxHorizontalInset = tokens.spacing.xl * 2.5;
    const maxVerticalInset = tokens.spacing.xl * 3;
    const horizontalInset = Math.min(frameRect.width * 0.08, maxHorizontalInset);
    const verticalInset = Math.min(frameRect.height * 0.08, maxVerticalInset);

    const safeLeft = frameRect.left + framePaddingLeft + horizontalInset;
    const safeRight = frameRect.right - framePaddingRight - horizontalInset;
    const safeTop = frameRect.top + framePaddingTop + verticalInset;
    const safeBottom = frameRect.bottom - framePaddingBottom - verticalInset;

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

    const topPercent = ((framePaddingTop + verticalInset) / frameRect.height) * 100;
    const bottomPercent = ((framePaddingBottom + verticalInset) / frameRect.height) * 100;
    const leftPercent = ((framePaddingLeft + horizontalInset) / frameRect.width) * 100;
    const rightPercent = ((framePaddingRight + horizontalInset) / frameRect.width) * 100;
    const computedBounds: GuardBounds = {
      top: Number.isFinite(topPercent) ? Math.max(0, Math.min(50, topPercent)) : 6,
      bottom: Number.isFinite(bottomPercent)
        ? Math.max(50, Math.min(100, 100 - bottomPercent))
        : 94,
      left: Number.isFinite(leftPercent) ? Math.max(0, Math.min(50, leftPercent)) : 8,
      right: Number.isFinite(rightPercent)
        ? Math.max(50, Math.min(100, 100 - rightPercent))
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

    const nextInsets = {
      top: verticalInset,
      bottom: verticalInset,
      left: horizontalInset,
      right: horizontalInset,
    };

    setSafeZoneInsets((prev) => {
      const withinThreshold =
        Math.abs(prev.top - nextInsets.top) < 0.5 &&
        Math.abs(prev.bottom - nextInsets.bottom) < 0.5 &&
        Math.abs(prev.left - nextInsets.left) < 0.5 &&
        Math.abs(prev.right - nextInsets.right) < 0.5;

      return withinThreshold ? prev : nextInsets;
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

  const canvasStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      flexDirection: 'column',
      gap: tokens.spacing.lg,
      minHeight: '100%',
      padding: `${safeZoneInsets.top}px ${safeZoneInsets.right}px ${safeZoneInsets.bottom}px ${safeZoneInsets.left}px`,
      boxSizing: 'border-box',
    }),
    [safeZoneInsets],
  );

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
  const tooltipVisible = showGuidelines && (hasGuardAlerts || guardInfoHover);

  const safeZoneToggleLabel = showGuidelines ? 'Hide Safe Zone' : 'Show Safe Zone';

  const safeZoneToggleStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
      borderRadius: tokens.radius.md,
      border: `${tokens.border.thin}px solid ${
        showGuidelines ? tokens.colors.borderStrong : tokens.colors.borderLight
      }`,
      background: showGuidelines ? tokens.colors.surfaceSubtle : tokens.colors.surface,
      color: tokens.colors.textSecondary,
      fontSize: tokens.fontSize.sm,
      fontWeight: tokens.fontWeight.medium,
      cursor: 'pointer',
      boxShadow: showGuidelines ? tokens.shadow.sm : tokens.shadow.none,
      transition: `background-color 160ms ${tokens.easing.standard}, border-color 160ms ${tokens.easing.standard}, box-shadow 160ms ${tokens.easing.standard}`,
    }),
    [showGuidelines],
  );

  return (
    <div style={rootStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: tokens.spacing.sm,
          padding: `${tokens.spacing.md}px ${tokens.spacing.xl}px`,
          borderBottom: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
          background: tokens.colors.surface,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
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
        <button
          type="button"
          onClick={() => setShowGuidelines((prev) => !prev)}
          style={safeZoneToggleStyle}
        >
          {safeZoneToggleLabel}
        </button>
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
                visible={showGuidelines}
                tooltip={
                  tooltipVisible
                    ? {
                        visible: tooltipVisible,
                        edge: tooltipEdge,
                        message: 'Keeping within the guide lines ensures visibility on all devices.',
                      }
                    : undefined
                }
                onInfoHoverChange={setGuardInfoHover}
                gridSpacing={tokens.spacing.lg}
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
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    onAddBlock();
                  }}
                  style={addButtonStyle}
                >
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
