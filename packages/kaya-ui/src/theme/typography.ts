import type { TextStyle } from "react-native";
import { colors } from "./colors";

/**
 * Inter scale, transcribed from app_typography.dart. Flutter's `height` is a
 * multiplier; React Native's `lineHeight` is absolute, so each is multiplied
 * out here rather than carried across as a ratio.
 */
export type TextStyleToken = TextStyle;

/**
 * Freezes each style as well as the map. Freezing only the map would leave
 * `typography.body.color = "red"` working, and these tokens back every screen
 * in both apps.
 */
const deepFreeze = <T extends Record<string, TextStyle>>(styles: T): Readonly<T> => {
  for (const style of Object.values(styles)) Object.freeze(style);
  return Object.freeze(styles);
};

export const typography = deepFreeze({
  // Tracking is size-specific: display sizes tighten (letters drift apart as
  // type grows), body stays at 0. One fixed letter-spacing is wrong somewhere.
  screenTitle: { fontFamily: "Inter", fontSize: 28, fontWeight: "800", lineHeight: 32, letterSpacing: -0.5, color: colors.ink },
  sectionTitle: { fontFamily: "Inter", fontSize: 22, fontWeight: "700", lineHeight: 26, letterSpacing: -0.3, color: colors.ink },
  cardTitle: { fontFamily: "Inter", fontSize: 17, fontWeight: "700", lineHeight: 21, color: colors.ink },

  body: { fontFamily: "Inter", fontSize: 15, fontWeight: "400", lineHeight: 21, color: colors.ink },
  bodyStrong: { fontFamily: "Inter", fontSize: 15, fontWeight: "600", lineHeight: 21, color: colors.ink },
  bodySecondary: { fontFamily: "Inter", fontSize: 15, fontWeight: "400", lineHeight: 21, color: colors.inkSecondary },
  caption: { fontFamily: "Inter", fontSize: 13, fontWeight: "400", color: colors.inkSecondary },

  price: { fontFamily: "Inter", fontSize: 20, fontWeight: "800", lineHeight: 22, letterSpacing: -0.3, color: colors.ink },
  priceLarge: { fontFamily: "Inter", fontSize: 26, fontWeight: "800", lineHeight: 29, letterSpacing: -0.4, color: colors.ink },
  // One step above priceLarge, and it exists for exactly one job: an amount
  // the user is *typing*. A driver entering a bid does it one-handed, in
  // sunlight, often propped on a bike — 26 is the right size to read a price
  // and too small to edit one. Everywhere else priceLarge stays the largest.
  priceXL: { fontFamily: "Inter", fontSize: 34, fontWeight: "800", lineHeight: 38, letterSpacing: -0.6, color: colors.ink },

  overline: { fontFamily: "Inter", fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: colors.inkTertiary },
  button: { fontFamily: "Inter", fontSize: 16, fontWeight: "700", color: colors.surface },
} as const satisfies Record<string, TextStyle>);
