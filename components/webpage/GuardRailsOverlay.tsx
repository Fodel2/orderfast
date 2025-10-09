import React from 'react';

import { tokens } from '@/src/ui/tokens';

export type GuardEdge = 'top' | 'right' | 'bottom' | 'left';

type GuardRailsOverlayProps = {
  bounds: Record<GuardEdge, number>;
  alerts: Record<GuardEdge, boolean>;
  visible: boolean;
  tooltip?: {
    visible: boolean;
    edge: GuardEdge;
    message: string;
  };
  onInfoHoverChange?: (hovered: boolean) => void;
};

const overlayLineBase = tokens.colors.overlay.soft;
const overlayAlertColor = 'rgba(220, 38, 38, 0.6)';

const tooltipOffset = tokens.spacing.md;

function getTooltipStyle(bounds: Record<GuardEdge, number>, edge: GuardEdge): React.CSSProperties {
  switch (edge) {
    case 'top':
      return {
        top: `calc(${bounds.top}% + ${tooltipOffset}px)`,
        left: '50%',
        transform: 'translate(-50%, 0)',
      };
    case 'bottom':
      return {
        top: `calc(${bounds.bottom}% - ${tooltipOffset}px)`,
        left: '50%',
        transform: 'translate(-50%, -100%)',
      };
    case 'left':
      return {
        left: `calc(${bounds.left}% + ${tooltipOffset}px)`,
        top: '50%',
        transform: 'translate(0, -50%)',
      };
    case 'right':
    default:
      return {
        left: `calc(${bounds.right}% - ${tooltipOffset}px)`,
        top: '50%',
        transform: 'translate(-100%, -50%)',
      };
  }
}

const GuardRailsOverlay: React.FC<GuardRailsOverlayProps> = ({
  bounds,
  alerts,
  visible,
  tooltip,
  onInfoHoverChange,
}) => {
  const edges: GuardEdge[] = ['top', 'right', 'bottom', 'left'];
  const tooltipVisible = tooltip?.visible ?? false;
  const tooltipEdge = tooltip?.edge ?? 'top';
  const tooltipMessage = tooltip?.message ?? '';

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease',
        zIndex: 10,
      }}
    >
      {edges.map((edge) => {
        const color = alerts[edge] ? overlayAlertColor : overlayLineBase;
        if (edge === 'top' || edge === 'bottom') {
          return (
            <div
              key={edge}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${bounds[edge]}%`,
                transform: 'translateY(-50%)',
                borderTop: `${tokens.border.thin}px dashed ${color}`,
              }}
            />
          );
        }
        return (
          <div
            key={edge}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${bounds[edge]}%`,
              transform: 'translateX(-50%)',
              borderLeft: `${tokens.border.thin}px dashed ${color}`,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          top: tokens.spacing.sm,
          right: tokens.spacing.sm,
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          onMouseEnter={() => onInfoHoverChange?.(true)}
          onFocus={() => onInfoHoverChange?.(true)}
          onMouseLeave={() => onInfoHoverChange?.(false)}
          onBlur={() => onInfoHoverChange?.(false)}
          style={{
            borderRadius: tokens.radius.sm,
            border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
            background: tokens.colors.surface,
            color: tokens.colors.textSecondary,
            padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
            fontSize: tokens.fontSize.xs,
            cursor: 'pointer',
          }}
        >
          Guide lines
        </button>
      </div>
      {tooltipVisible ? (
        <div
          style={{
            position: 'absolute',
            ...getTooltipStyle(bounds, tooltipEdge),
            background: tokens.colors.surface,
            color: tokens.colors.textSecondary,
            borderRadius: tokens.radius.sm,
            border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
            padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
            boxShadow: tokens.shadow.sm,
            fontSize: tokens.fontSize.xs,
            maxWidth: 240,
            lineHeight: tokens.lineHeight.normal,
            pointerEvents: 'none',
          }}
        >
          {tooltipMessage}
        </div>
      ) : null}
    </div>
  );
};

export default GuardRailsOverlay;
