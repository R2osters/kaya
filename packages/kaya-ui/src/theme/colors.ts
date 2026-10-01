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

  // Modal barrier behind a bottom sheet or dialog. `showModalBottomSheet`
  // gave the Flutter original a barrier colour for free (Material's default
  // Colors.black54); this is the same idea, tinted from `ink` rather than
  // pure black to stay in the palette's own hue.
  scrim: "rgba(11, 18, 32, 0.55)",

  // The tint a glass surface sits on: 78% white, so type on a floating bar
  // stays legible over whatever the map happens to be showing underneath. The
  // blur alone does not guarantee that — a dark satellite tile blurs to a dark
  // smear — which is why the design specifies a tint *and* an intensity.
  glassTint: "rgba(255, 255, 255, 0.78)",
} as const);

export type ColorToken = keyof typeof colors;
