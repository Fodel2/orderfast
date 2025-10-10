import React, { useMemo, useState } from 'react';

import { ZoomIn, ZoomOut } from 'lucide-react';

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
  const [zoomLevel, setZoomLevel] = useState(1);
  const shellStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%',
      background: tokens.colors.canvas,
      fontFamily: tokens.fonts.sans,
      fontSize: tokens.fontSize.md,
      color: tokens.colors.textPrimary,
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

  const contentStyle: React.CSSProperties = {
    flex: 1,
    paddingTop: 0,
    display: 'flex',
    flexDirection: 'column',
  };

  const scrollAreaStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    height: 'auto',
    maxHeight: 'calc(100vh - 140px)',
    paddingTop: 0,
    paddingBottom: 56,
    paddingLeft: `calc(${tokens.spacing.lg}px + env(safe-area-inset-left))`,
    paddingRight: `calc(${tokens.spacing.lg}px + env(safe-area-inset-right))`,
    background: tokens.colors.surfaceSubtle,
  };

  const frameStyle = useMemo<React.CSSProperties>(() => {
    const style: React.CSSProperties = {
      width: DEVICE_PREVIEW_WIDTHS[device],
      minWidth: DEVICE_PREVIEW_WIDTHS[device],
      borderRadius: tokens.radius.lg,
      boxShadow: tokens.shadow.lg,
      background: tokens.colors.surface,
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'relative',
      zIndex: 30,
    };

    if (device === 'desktop') {
      delete style.margin;
    }

    return style;
  }, [device]);

  const previewStyle = useMemo<React.CSSProperties>(() => {
    const width = DEVICE_PREVIEW_WIDTHS[device];
    return {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width,
      minWidth: width,
      transform: `scale(${zoomLevel})`,
      transformOrigin: 'top center',
    } satisfies React.CSSProperties;
  }, [device, zoomLevel]);

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

  const adjustZoom = (delta: number) => {
    setZoomLevel((previous) => {
      const next = Math.round((previous + delta) * 100) / 100;
      if (next < 0.5) return 0.5;
      if (next > 1.25) return 1.25;
      return next;
    });
  };

  const handleZoomOut = () => {
    adjustZoom(-0.1);
  };

  const handleZoomIn = () => {
    adjustZoom(0.1);
  };

  const zoomOutDisabled = zoomLevel <= 0.5;
  const zoomInDisabled = zoomLevel >= 1.25;

  const previewWrapperClassName = `wb-preview-shell${
    device === 'desktop' ? ' wb-desktop' : ''
  }`;

  const previewContent = (
    <div className={previewWrapperClassName} data-device={device}>
      <div
        className="builder-preview wb-preview"
        data-device={device}
        style={previewStyle}
      >
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
    </div>
  );

  return (
    <div style={shellStyle}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingLeft: `calc(${tokens.spacing.lg}px + env(safe-area-inset-left))`,
          paddingRight: `calc(${tokens.spacing.lg}px + env(safe-area-inset-right))`,
          height: 'auto',
          minHeight: 44,
          borderBottom: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
          background: tokens.colors.surface,
          position: 'sticky',
          top: 0,
          zIndex: 40,
          margin: '6px 0 8px',
          paddingTop: tokens.spacing.xs,
          paddingBottom: tokens.spacing.xs,
        }}
        className="wb-device-toggle"
      >
        <div
          style={{
            flex: '1 1 160px',
            display: 'flex',
            justifyContent: 'flex-start',
            minHeight: 28,
          }}
        />
        <div
          className="device-controls"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
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
        <div
          style={{
            flex: '1 1 160px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 6,
            minHeight: 28,
          }}
        >
          <button
            type="button"
            onClick={handleZoomOut}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: tokens.radius.lg,
              border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
              background: tokens.colors.surface,
              color: tokens.colors.textSecondary,
              cursor: zoomOutDisabled ? 'not-allowed' : 'pointer',
              opacity: zoomOutDisabled ? 0.5 : 1,
              transition: `color 160ms ${tokens.easing.standard}, background-color 160ms ${tokens.easing.standard}, border-color 160ms ${tokens.easing.standard}`,
            }}
            aria-label="Zoom out"
            disabled={zoomOutDisabled}
          >
            <ZoomOut size={16} />
          </button>
          <span
            style={{
              fontSize: 12,
              color: tokens.colors.textSecondary,
              minWidth: 44,
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: tokens.radius.lg,
              border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
              background: tokens.colors.surface,
              color: tokens.colors.textSecondary,
              cursor: zoomInDisabled ? 'not-allowed' : 'pointer',
              opacity: zoomInDisabled ? 0.5 : 1,
              transition: `color 160ms ${tokens.easing.standard}, background-color 160ms ${tokens.easing.standard}, border-color 160ms ${tokens.easing.standard}`,
            }}
            aria-label="Zoom in"
            disabled={zoomInDisabled}
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>
      <div style={contentStyle}>
        <div style={scrollAreaStyle}>
          <div
            id="wb-canvas"
            data-preview-scroller
            className="wb-preview-wrapper"
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              overflowX: 'auto',
              overflowY: 'auto',
              width: '100%',
              maxWidth: 'none',
              padding: 0,
              margin: 0,
            }}
          >
            {device === 'desktop' ? (
              <div className="wb-desktop-wrapper">{previewContent}</div>
            ) : (
              previewContent
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
