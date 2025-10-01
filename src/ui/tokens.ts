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
