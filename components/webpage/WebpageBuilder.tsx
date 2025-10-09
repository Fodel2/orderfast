import React, { useMemo, useState } from 'react';
import DraggableBlock from './DraggableBlock';
import PageRenderer, { type Block } from '../PageRenderer';
import { tokens } from '@/src/ui/tokens';

type DeviceKind = 'mobile' | 'tablet' | 'desktop';

type WebpageBuilderProps = {
  blocks: Block[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onMoveBlock: (id: string, direction: -1 | 1) => void;
  onAddBlock: () => void;
};

export default function WebpageBuilder({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveBlock,
  onAddBlock,
}: WebpageBuilderProps) {
  const [device, setDevice] = useState<DeviceKind>('desktop');
  const deviceWidths: Record<DeviceKind, number> = {
    mobile: 375,
    tablet: 768,
    desktop: 1024,
  };

  const canvasWidth = deviceWidths[device];

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
    width: '100%',
    maxWidth: canvasWidth,
    transition: `max-width 220ms ${tokens.easing.standard}`,
  };

  const canvasStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.md,
    minHeight: '100%',
  };

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
              style={{
                background: tokens.colors.surface,
                borderRadius: tokens.radius.lg,
                padding: tokens.spacing.lg,
                boxShadow: tokens.shadow.sm,
                transition: `box-shadow 200ms ${tokens.easing.standard}`,
              }}
            >
              <div style={canvasStyle}>
                {blocks.length === 0 && (
                  <div
                    style={{
                      padding: tokens.spacing.lg,
                      textAlign: 'center',
                      color: tokens.colors.textMuted,
                    }}
                  >
                    Click “Add block” or use the palette to start building your page.
                  </div>
                )}
                {blocks.map((block, index) => (
                  <DraggableBlock
                    key={block.id}
                    id={block.id}
                    onDelete={() => onDeleteBlock(block.id)}
                    onDuplicate={() => onDuplicateBlock(block.id)}
                    onMoveUp={() => onMoveBlock(block.id, -1)}
                    onMoveDown={() => onMoveBlock(block.id, 1)}
                    disableMoveUp={index === 0}
                    disableMoveDown={index === blocks.length - 1}
                    isSelected={selectedBlockId === block.id}
                    onSelect={() => onSelectBlock(block.id)}
                  >
                    <PageRenderer blocks={[block]} />
                  </DraggableBlock>
                ))}
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
