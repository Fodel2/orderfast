import React, { useMemo } from 'react';

import { tokens } from '@/src/ui/tokens';

type MobileInspectorProps = {
  className?: string;
  open: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  renderContent: () => React.ReactNode;
};

const MobileInspector: React.FC<MobileInspectorProps> = ({
  className,
  open,
  title = 'Inspector',
  subtitle,
  onClose,
  renderContent,
}) => {
  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 62,
      maxHeight: '50%',
      background: tokens.colors.surface,
      borderTop: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
      display: 'flex',
      flexDirection: 'column',
      padding: tokens.spacing.lg,
      paddingLeft: `calc(${tokens.spacing.lg}px + env(safe-area-inset-left))`,
      paddingRight: `calc(${tokens.spacing.lg}px + env(safe-area-inset-right))`,
      paddingBottom: `calc(${tokens.spacing.lg}px + env(safe-area-inset-bottom))`,
      gap: tokens.spacing.md,
      boxSizing: 'border-box',
    }),
    [],
  );

  const headerStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: tokens.spacing.sm,
    }),
    [],
  );

  const titleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontWeight: tokens.fontWeight.semibold,
      color: tokens.colors.textSecondary,
    }),
    [],
  );

  const subtitleStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: tokens.fontSize.sm,
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
      flexShrink: 0,
    }),
    [],
  );

  const contentStyle = useMemo<React.CSSProperties>(
    () => ({
      overflowY: 'auto',
      marginTop: tokens.spacing.sm,
    }),
    [],
  );

  if (!open) {
    return null;
  }

  const containerClassName = [className].filter(Boolean).join(' ');

  return (
    <div data-inspector="drawer" className={containerClassName} style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={titleStyle}>{title}</span>
          {subtitle ? <span style={subtitleStyle}>{subtitle}</span> : null}
        </div>
        <button type="button" onClick={onClose} style={closeButtonStyle}>
          Close
        </button>
      </div>
      <div style={contentStyle}>{renderContent()}</div>
    </div>
  );
};

export default MobileInspector;
