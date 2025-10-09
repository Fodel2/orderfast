import React, { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
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
  onReorderBlocks: (next: Block[]) => void;
  onAddBlock: () => void;
};

export default function WebpageBuilder({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveBlock,
  onReorderBlocks,
  onAddBlock,
}: WebpageBuilderProps) {
  const [device, setDevice] = useState<DeviceKind>('desktop');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const blockIds = useMemo(() => blocks.map((block) => block.id), [blocks]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blockIds.indexOf(active.id as string);
    const newIndex = blockIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(blocks, oldIndex, newIndex);
    onReorderBlocks(next);
  };

  const canvasWidth = device === 'mobile' ? 390 : device === 'tablet' ? 820 : 1100;

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
  };

  const viewportStyle: React.CSSProperties = {
    maxWidth: canvasWidth,
    width: '100%',
    margin: '0 auto',
    padding: tokens.spacing.xl,
    boxSizing: 'border-box',
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
                textTransform: 'capitalize',
                padding: `${tokens.spacing.xs}px ${tokens.spacing.md}px`,
                borderRadius: tokens.radius.lg,
                border: `${tokens.border.thin}px solid ${
                  isActive ? tokens.colors.accent : tokens.colors.borderLight
                }`,
                background: isActive ? tokens.colors.surfaceSubtle : tokens.colors.surface,
                color: isActive ? tokens.colors.accent : tokens.colors.textSecondary,
                cursor: 'pointer',
                transition: `all 150ms ${tokens.easing.standard}`,
              }}
            >
              {value}
            </button>
          );
        })}
      </div>
      <div style={scrollAreaStyle}>
        <div style={viewportStyle}>
          <div
            style={{
              background: tokens.colors.surface,
              borderRadius: tokens.radius.lg,
              padding: tokens.spacing.lg,
              boxShadow: tokens.shadow.sm,
            }}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
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
              </SortableContext>
            </DndContext>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button type="button" onClick={onAddBlock} style={addButtonStyle}>
                + Add block
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
