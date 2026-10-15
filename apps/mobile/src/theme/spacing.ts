/** 4-pt spacing scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999,
} as const;

/** Height of the "3D" bottom edge on buttons and pressable cards. */
export const depth = {
  button: 5,
  card: 4,
} as const;

/** Minimum touch target (Apple HIG / Material both recommend ~44–48). */
export const touchTarget = 52;
