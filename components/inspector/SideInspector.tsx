import React, { useMemo } from 'react';

import type { Block } from '../PageRenderer';
import { tokens } from '@/src/ui/tokens';

type SideInspectorProps = {
  className?: string;
  open: boolean;
  selectedBlock: Block | null;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  renderContent: () => React.ReactNode;
  emptyState?: React.ReactNode;
};

const defaultEmptyState = (
  <div style={{ fontSize: tokens.fontSize.sm, color: tokens.colors.textMuted }}>
    Select a block to edit its properties.
  </div>
);

const SideInspector: React.FC<SideInspectorProps> = ({
  className,
  open,
  selectedBlock,
  title = 'Inspector',
  subtitle,
  onClose,
  renderContent,
  emptyState = defaultEmptyState,
}) => {
  const containerStyle = useMemo<React.CSSProperties>(() => ({
    width: open ? 320 : 0,
    transition: `width 240ms ${tokens.easing.standard}`,
    borderLeft: open ? `${tokens.border.thin}px solid ${tokens.colors.borderLight}` : 'none',
    background: tokens.colors.surface,
    boxShadow: open ? tokens.shadow.sm : 'none',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  }), [open]);

  const headerStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: tokens.spacing.lg,
      borderBottom: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: tokens.spacing.sm,
    }),
    [],
  );

  const titleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.fontSize.sm,
      fontWeight: tokens.fontWeight.semibold,
      color: tokens.colors.textSecondary,
      textTransform: 'uppercase',
    }),
    [],
  );

  const subtitleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.fontSize.xs,
      color: tokens.colors.textMuted,
    }),
    [],
  );

  const closeButtonStyle = useMemo<React.CSSProperties>(
    () => ({
      borderRadius: tokens.radius.sm,
      border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
      background: tokens.colors.surface,
      color: tokens.colors.textSecondary,
      padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
      cursor: 'pointer',
    }),
    [],
  );

  const contentStyle = useMemo<React.CSSProperties>(
    () => ({
      flex: 1,
      overflowY: 'auto',
      padding: tokens.spacing.lg,
    }),
    [],
  );

  const containerClassName = ['flex', className].filter(Boolean).join(' ');

  return (
    <div className={containerClassName} style={containerStyle}>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={headerStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={titleStyle}>{title}</span>
              {subtitle ? <span style={subtitleStyle}>{subtitle}</span> : null}
            </div>
            <button type="button" onClick={onClose} style={closeButtonStyle}>
              Close
            </button>
          </div>
          <div style={contentStyle}>
            {selectedBlock ? renderContent() : emptyState}
          </div>
        </div>
      )}
    </div>
  );
};

export function InspectorViewportStyles() {
  return (
    <style jsx global>{`
      @media (max-width: 900px) {
        .wb-inspector--side {
          display: none !important;
        }
      }
      @media (min-width: 901px) {
        .wb-inspector--bottom {
          display: none !important;
        }
      }
    `}</style>
  );
}

export default SideInspector;
