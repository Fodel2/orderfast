export const tokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 16,
  },
  control: {
    height: 32,
    numberWidth: 80,
    labelWidth: 112,
  },
  colors: {
    accent: "var(--accent, #0ea5e9)",
    accentStrong: "var(--accent-strong, #0284c7)",
    focusRing: "var(--focus-ring, var(--accent, #0ea5e9))",
    surface: "var(--surface, #ffffff)",
    surfaceSubtle: "var(--surface-subtle, #f8fafc)",
    surfaceHover: "var(--surface-hover, rgba(15, 23, 42, 0.04))",
    surfaceActive: "var(--surface-active, rgba(15, 23, 42, 0.08))",
    textPrimary: "var(--text-primary, #0f172a)",
    textSecondary: "var(--text-secondary, #475569)",
    textMuted: "var(--text-muted, #64748b)",
    textSubtle: "var(--text-subtle, rgba(100, 116, 139, 0.9))",
    neutral: {
      100: "var(--neutral-100, #f1f5f9)",
      200: "var(--neutral-200, #e2e8f0)",
      300: "var(--neutral-300, #cbd5f5)",
      400: "var(--neutral-400, #94a3b8)",
      500: "var(--neutral-500, #64748b)",
      600: "var(--neutral-600, #475569)",
    },
    borderLight: "var(--border-light, rgba(15, 23, 42, 0.08))",
    borderStrong: "var(--border-strong, rgba(15, 23, 42, 0.12))",
  },
  breakpoints: {
    sm: 640,
  },
  opacity: {
    0: 0,
    25: 0.25,
    50: 0.5,
    75: 0.75,
    100: 1,
  },
  border: {
    thin: 1,
    thick: 2,
  },
  shadow: {
    sm: "0 1px 2px rgba(0,0,0,.1)",
    md: "0 2px 4px rgba(0,0,0,.1)",
  },
} as const;

export type Tokens = typeof tokens;
