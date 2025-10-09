import React, { useMemo, useState } from 'react';
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
  const [hovered, setHovered] = useState(false);

  const cardStyle = useMemo<React.CSSProperties>(
    () => ({
      transition: `box-shadow 180ms ${tokens.easing.standard}, border-color 180ms ${tokens.easing.standard}, transform 180ms ${tokens.easing.standard}`,
      boxShadow: hovered || isSelected ? tokens.shadow.sm : tokens.shadow.none,
      background: tokens.colors.surface,
      borderRadius: tokens.radius.lg,
      border: `${tokens.border.thin}px solid ${isSelected ? tokens.colors.accent : tokens.colors.borderLight}`,
      position: 'relative',
      padding: tokens.spacing.md,
      display: 'flex',
      flexDirection: 'column',
      gap: tokens.spacing.sm,
      transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      outline: 'none',
    }),
    [hovered, isSelected]
  );

  const actionBarStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'absolute',
      top: tokens.spacing.sm,
      right: tokens.spacing.sm,
      display: 'flex',
      gap: tokens.spacing.xs,
      opacity: hovered || isSelected ? 1 : 0,
      pointerEvents: hovered || isSelected ? 'auto' : 'none',
      transition: `opacity 150ms ${tokens.easing.standard}`,
    }),
    [hovered, isSelected]
  );

  const actionButtonStyle = useMemo<React.CSSProperties>(
    () => ({
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
      cursor: 'pointer',
    }),
    []
  );

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

  return (
    <div
      data-block-id={id}
      style={cardStyle}
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
        <div
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: tokens.spacing.lg,
            height: tokens.spacing.lg,
            borderRadius: tokens.radius.sm,
            border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
            background: tokens.colors.surfaceSubtle,
            color: tokens.colors.textSecondary,
          }}
        >
          <GripVertical size={16} strokeWidth={1.5} />
        </div>
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
          style={actionButtonStyle}
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
