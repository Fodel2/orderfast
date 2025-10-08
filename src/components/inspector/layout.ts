import { tokens } from "../../ui/tokens";

export const inspectorLayout = {
  labelWidth: tokens.control.labelWidth,
  controlHeight: tokens.control.height,
  numberWidth: tokens.control.numberWidth,
  gap: tokens.spacing.sm,
  paddingX: tokens.spacing.sm,
  paddingY: tokens.spacing.xs,
  radius: tokens.radius.sm,
  borderWidth: tokens.border.thin,
  mobileBreakpoint: tokens.breakpoints.sm,
};

export const inspectorColors = {
  label: `var(--inspector-label, ${tokens.colors.textSecondary})`,
  labelMuted: `var(--inspector-label-muted, ${tokens.colors.textMuted})`,
  text: `var(--inspector-text, ${tokens.colors.textPrimary})`,
  border: `var(--inspector-border, ${tokens.colors.borderStrong})`,
  background: `var(--inspector-background, ${tokens.colors.surface})`,
  surfaceHover: `var(--inspector-surface-hover, ${tokens.colors.surfaceHover})`,
  surfaceActive: `var(--inspector-surface-active, ${tokens.colors.surfaceActive})`,
};
