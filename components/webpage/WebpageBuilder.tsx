import React, { useMemo, useState } from 'react';

import PageRenderer, { type Block, type DeviceKind } from '../PageRenderer';

import DraggableBlock from './DraggableBlock';
import { tokens } from '@/src/ui/tokens';

const DEVICE_WIDTHS: Record<DeviceKind, number> = {
  mobile: 420,
  tablet: 768,
  desktop: 1024,
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
  type ShellStyle = React.CSSProperties & { '--wb-canvas-max'?: string };

  const shellStyle = useMemo<ShellStyle>(
    () => ({
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%',
      background: tokens.colors.canvas,
      fontFamily: tokens.fonts.sans,
      fontSize: tokens.fontSize.md,
      color: tokens.colors.textPrimary,
      ['--wb-canvas-max']: `${DEVICE_WIDTHS[device]}px`,
    }),
    [device],
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
    overflowY: 'auto',
    overflowX: 'hidden',
    height: 'auto',
    maxHeight: 'calc(100vh - 140px)',
    paddingTop: 0,
    paddingBottom: 56,
    paddingLeft: `calc(${tokens.spacing.lg}px + env(safe-area-inset-left))`,
    paddingRight: `calc(${tokens.spacing.lg}px + env(safe-area-inset-right))`,
    background: tokens.colors.surfaceSubtle,
  };

  const frameStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 'var(--wb-canvas-max, 420px)',
    borderRadius: tokens.radius.lg,
    boxShadow: tokens.shadow.lg,
    background: tokens.colors.surface,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    zIndex: 30,
  };

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
    position: 'sticky',
    bottom: tokens.spacing.md,
    zIndex: 30,
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

  return (
    <div style={shellStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingLeft: `calc(${tokens.spacing.lg}px + env(safe-area-inset-left))`,
          paddingRight: `calc(${tokens.spacing.lg}px + env(safe-area-inset-right))`,
          height: 44,
          borderBottom: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
          background: tokens.colors.surface,
          position: 'sticky',
          top: 0,
          zIndex: 40,
          margin: '6px 0 8px',
        }}
        className="wb-device-toggle"
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
      <div style={contentStyle}>
        <div
          id="wb-canvas"
          data-preview-scroller
          style={scrollAreaStyle}
          className="wb-preview overflow-auto"
        >
          <div style={frameStyle} className="wb-canvas">
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
    </div>
  );
}
