import React, { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';

import PageRenderer, { type Block, type DeviceKind } from '../PageRenderer';

import DraggableBlock from './DraggableBlock';
import { tokens } from '@/src/ui/tokens';

type WebpageBuilderProps = {
  blocks: Block[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onMoveBlock: (id: string, direction: -1 | 1) => void;
  onAddBlock: () => void;
  device: DeviceKind;
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
  device,
  inspectorVisible = false,
}: WebpageBuilderProps) {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const blockPreviewMap = useMemo(() => {
    const entries = new Map<string, React.ReactNode>();
    blocks.forEach((block) => {
      entries.set(
        block.id,
        <PageRenderer blocks={[block]} device={device} />,
      );
    });
    return entries;
  }, [blocks, device]);
  const deviceWidths: Record<DeviceKind, number> = {
    mobile: 375,
    tablet: 768,
    desktop: 1024,
  };

  const canvasWidth = deviceWidths[device];
  const previousDeviceRef = useRef<DeviceKind>(device);
  useEffect(() => {
    if (previousDeviceRef.current === device) return;
    const node = scrollAreaRef.current;
    const previousScrollTop = node?.scrollTop ?? 0;
    previousDeviceRef.current = device;
    if (!node) return;
    if (typeof window === 'undefined') {
      node.scrollTop = previousScrollTop;
      return;
    }
    window.requestAnimationFrame(() => {
      node.scrollTop = previousScrollTop;
    });
  }, [device]);

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
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'stretch',
  };

  const viewportStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 1440,
    margin: '0 auto',
    padding: `${tokens.spacing.xl}px ${tokens.spacing.xl}px`,
    minHeight: '100%',
    boxSizing: 'border-box',
    transition: `padding 220ms ${tokens.easing.standard}`,
  };

  const frameStyle: React.CSSProperties = {
    width: `${canvasWidth}px`,
    maxWidth: `${canvasWidth}px`,
    flex: '0 0 auto',
    marginLeft: 'auto',
    marginRight: 'auto',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'stretch',
    transition: `max-width 220ms ${tokens.easing.standard}`,
  };

  const canvasStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.xl,
    minHeight: '100%',
    padding: tokens.spacing.xl,
    boxSizing: 'border-box',
  };

  const headerBlockId = useMemo(
    () => blocks.find((block) => block.type === 'header')?.id ?? null,
    [blocks],
  );

  const addButtonStyle: React.CSSProperties = {
    alignSelf: 'center',
    marginTop: blocks.length ? tokens.spacing.xl : 0,
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
      <div style={scrollAreaStyle} ref={scrollAreaRef}>
        <div style={viewportStyle}>
          <div style={frameStyle}>
            <div
              style={{
                position: 'relative',
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
                  const preview =
                    blockPreviewMap.get(block.id) ?? <PageRenderer blocks={[block]} device={device} />;
                  return (
                    <motion.div
                      key={block.id}
                      layout
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      style={{ width: '100%' }}
                    >
                      <DraggableBlock
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
                        {preview}
                      </DraggableBlock>
                    </motion.div>
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
