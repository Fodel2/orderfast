import React, { useMemo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, Copy, GripVertical, Trash2 } from 'lucide-react';
import { tokens } from '@/src/ui/tokens';

type DraggableBlockProps = {
  id: string;
  children: React.ReactNode;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  disableMoveUp?: boolean;
  disableMoveDown?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
};

export default function DraggableBlock({
  id,
  children,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
  isSelected,
  onSelect,
}: DraggableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id });
  const [hovered, setHovered] = useState(false);

  const style = useMemo<React.CSSProperties>(() => {
    const translate = CSS.Transform.toString(transform);
    const baseTransition = transition ?? `transform 150ms ${tokens.easing.standard}`;
    const resolvedShadow = isDragging
      ? tokens.shadow.md
      : hovered
      ? tokens.shadow.sm
      : tokens.shadow.none;

    return {
      transform: translate,
      transition: `${baseTransition}, box-shadow 150ms ${tokens.easing.standard}, border-color 150ms ${tokens.easing.standard}, outline-color 150ms ${tokens.easing.standard}`,
      boxShadow: resolvedShadow,
      background: tokens.colors.surface,
      borderRadius: tokens.radius.lg,
      border: `${tokens.border.thin}px solid ${isSelected ? tokens.colors.accent : tokens.colors.borderLight}`,
      outline:
        isOver && !isDragging
          ? `${tokens.border.thick}px dashed ${tokens.colors.accent}`
          : 'none',
      outlineOffset: tokens.spacing.xs / 2,
      cursor: isDragging ? 'grabbing' : 'default',
      position: 'relative',
      padding: tokens.spacing.md,
      display: 'flex',
      flexDirection: 'column',
      gap: tokens.spacing.sm,
    };
  }, [hovered, isDragging, isOver, isSelected, transform, transition]);

  const handlePointerEnter = () => setHovered(true);
  const handlePointerLeave = () => setHovered(false);
  const handleFocus = () => setHovered(true);
  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setHovered(false);
    }
  };

  const handleSelect = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onSelect?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.();
    }
  };

  const actionBarStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    top: tokens.spacing.sm,
    right: tokens.spacing.sm,
    display: 'flex',
    gap: tokens.spacing.xs,
    opacity: hovered || isSelected ? 1 : 0,
    pointerEvents: hovered || isSelected ? 'auto' : 'none',
    transition: `opacity 150ms ${tokens.easing.standard}`,
  }), [hovered, isSelected]);

  const actionButtonStyle = useMemo<React.CSSProperties>(() => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: tokens.spacing.lg,
    height: tokens.spacing.lg,
    borderRadius: tokens.radius.sm,
    border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
    background: tokens.colors.surface,
    color: tokens.colors.textSecondary,
    transition: `border-color 150ms ${tokens.easing.standard}, color 150ms ${tokens.easing.standard}, background-color 150ms ${tokens.easing.standard}`,
  }), []);

  const handleProps = {
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
    },
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
    },
  } as const;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="listitem"
      aria-pressed={isSelected}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: tokens.spacing.sm,
        }}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          {...handleProps}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: tokens.spacing.lg,
            height: tokens.spacing.lg,
            borderRadius: tokens.radius.sm,
            border: `${tokens.border.thin}px solid transparent`,
            background: tokens.colors.surfaceSubtle,
            color: tokens.colors.textSecondary,
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          aria-label="Reorder block"
        >
          <GripVertical size={16} strokeWidth={1.5} />
        </button>
        <div style={{ flex: 1 }}>{children}</div>
      </div>
      <div style={actionBarStyle}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onMoveUp?.();
          }}
          disabled={disableMoveUp}
          style={{
            ...actionButtonStyle,
            opacity: disableMoveUp ? 0.5 : 1,
            cursor: disableMoveUp ? 'not-allowed' : 'pointer',
          }}
          aria-label="Move block up"
        >
          <ChevronUp size={14} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onMoveDown?.();
          }}
          disabled={disableMoveDown}
          style={{
            ...actionButtonStyle,
            opacity: disableMoveDown ? 0.5 : 1,
            cursor: disableMoveDown ? 'not-allowed' : 'pointer',
          }}
          aria-label="Move block down"
        >
          <ChevronDown size={14} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate();
          }}
          style={{ ...actionButtonStyle, cursor: 'pointer' }}
          aria-label="Duplicate block"
        >
          <Copy size={14} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          style={{
            ...actionButtonStyle,
            color: '#dc2626',
            borderColor: 'rgba(220, 38, 38, 0.2)',
            cursor: 'pointer',
          }}
          aria-label="Delete block"
        >
          <Trash2 size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
