/**
 * "Accra Minimalist Delivery" palette, transcribed from
 * legacy/flutter/kaya_core/lib/src/theme/app_colors.dart. These are the design
 * reference's exact values — do not introduce a colour literal anywhere else in
 * the app; extend this file instead. A lint rule enforces that.
 */
export const colors = Object.freeze({
  // Brand / actions
  primary: "#1466FF",
  success: "#12A150",
  danger: "#E5484D",
  amber: "#F5A623",

  // Text / ink
  ink: "#0B1220",
  inkSecondary: "#5B6472",
  inkTertiary: "#8A94A6",

  // Surfaces
  surface: "#FFFFFF",
  background: "#F4F6F9",
  border: "#E7EAF0",
  borderSoft: "#EBEEF3",

  // Soft chip / badge backgrounds
  primaryTint: "#EAF1FF",
  successTint: "#E6F5EC",
  dangerTint: "#FCEBEC",
  amberTint: "#FEF3E0",

  // Map markers: green = pickup, blue = drop-off
  markerPickup: "#12A150",
  markerDropoff: "#1466FF",
} as const);

export type ColorToken = keyof typeof colors;
