import React, { useEffect, useMemo, useState } from 'react';

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
  const [zoom, setZoom] = useState(100);
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

  return (
    <div
      className="builder-wrapper fixed inset-0 z-50 flex flex-col bg-background"
      style={shellStyle}
    >
      <div
        className="builder-toolbar sticky top-0 z-50 flex items-center justify-between px-4 py-2 border-b bg-white"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 60,
          borderBottom: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
          background: tokens.colors.surface,
          minHeight: 52,
        }}
      >
        <div className="device-controls" aria-label="Preview device selector">
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
          className="zoom-controls"
          style={{
            position: 'absolute',
            top: tokens.spacing.sm,
            right: tokens.spacing.lg,
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing.xs,
            zIndex: 60,
          }}
        >
          <button
            type="button"
            onClick={handleZoomOut}
            className="zoom-btn"
            aria-label="Zoom out"
            disabled={zoomOutDisabled}
          >
            <ZoomOut size={16} />
          </button>
          <span className="zoom-readout">{zoom}%</span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="zoom-btn"
            aria-label="Zoom in"
            disabled={zoomInDisabled}
          >
            <ZoomIn size={16} />
          </button>
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
