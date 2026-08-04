/** Corner radii: buttons/fields 14–16, cards 18–20, sheets 28, pills 999. */
export const radii = Object.freeze({
  field: 14,
  button: 16,
  cardTight: 18,
  card: 20,
  sheet: 28,
  pill: 999,
} as const);

/** 4pt spacing grid, shared by both apps. */
export const spacing = Object.freeze({
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const);

/** Minimum touch target from the design system. */
export const minTouch = 44;
