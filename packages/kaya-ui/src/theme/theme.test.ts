import * as root from "../index";
import { colors, minTouch, radii, shadows, spacing, typography } from "./index";

describe("design tokens", () => {
  it("carries the exact Accra Minimalist palette", () => {
    expect(colors.primary).toBe("#1466FF");
    expect(colors.success).toBe("#12A150");
    expect(colors.danger).toBe("#E5484D");
    expect(colors.amber).toBe("#F5A623");
    expect(colors.ink).toBe("#0B1220");
    expect(colors.inkSecondary).toBe("#5B6472");
    expect(colors.inkTertiary).toBe("#8A94A6");
    expect(colors.surface).toBe("#FFFFFF");
    expect(colors.background).toBe("#F4F6F9");
    expect(colors.border).toBe("#E7EAF0");
    expect(colors.borderSoft).toBe("#EBEEF3");
  });

  it("carries the soft tints used by pills and badges", () => {
    expect(colors.primaryTint).toBe("#EAF1FF");
    expect(colors.successTint).toBe("#E6F5EC");
    expect(colors.dangerTint).toBe("#FCEBEC");
    expect(colors.amberTint).toBe("#FEF3E0");
  });

  it("maps pickup to success and dropoff to primary", () => {
    // Green = pickup, blue = drop-off, per the design reference.
    expect(colors.markerPickup).toBe(colors.success);
    expect(colors.markerDropoff).toBe(colors.primary);
  });

  it("carries the radius and spacing scales", () => {
    expect(radii).toEqual({ field: 14, button: 16, cardTight: 18, card: 20, sheet: 28, pill: 999 });
    expect(spacing).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 });
    expect(minTouch).toBe(44);
  });

  it("exposes the three shadow presets", () => {
    for (const preset of [shadows.card, shadows.soft, shadows.sheet]) {
      expect(typeof preset.shadowColor).toBe("string");
      expect(typeof preset.elevation).toBe("number");
    }
    // The sheet shadow rises upward; the others fall.
    expect(shadows.sheet.shadowOffset.height).toBeLessThan(0);
    expect(shadows.card.shadowOffset.height).toBeGreaterThan(0);
  });

  it("carries the Inter type scale with the documented weights", () => {
    expect(typography.screenTitle).toMatchObject({ fontSize: 28, fontWeight: "800" });
    expect(typography.sectionTitle).toMatchObject({ fontSize: 22, fontWeight: "700" });
    expect(typography.cardTitle).toMatchObject({ fontSize: 17, fontWeight: "700" });
    expect(typography.body).toMatchObject({ fontSize: 15, fontWeight: "400" });
    expect(typography.price).toMatchObject({ fontSize: 20, fontWeight: "800" });
    expect(typography.priceLarge).toMatchObject({ fontSize: 26, fontWeight: "800" });
    expect(typography.overline).toMatchObject({ fontSize: 12, letterSpacing: 1.1 });
    expect(typography.button).toMatchObject({ fontSize: 16, fontWeight: "700" });
  });

  it("carries the exact shadow values, not merely plausible ones", () => {
    // The Flutter originals used a negative BoxShadow spread that React Native
    // cannot express, so these numbers are a translation. Asserting only their
    // types would let 0.6 pass where 0.06 was meant.
    expect(shadows.card).toEqual({
      shadowColor: "#0B1220",
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    });
    expect(shadows.soft).toEqual({
      shadowColor: "#0B1220",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    });
    expect(shadows.sheet).toEqual({
      shadowColor: "#0B1220",
      shadowOpacity: 0.1,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: -8 },
      elevation: 12,
    });
  });

  it("multiplies out Flutter's line-height ratios", () => {
    // Flutter's `height` is a multiplier; React Native's lineHeight is
    // absolute. These are the products, and they are the values most likely to
    // be silently wrong.
    expect(typography.screenTitle.lineHeight).toBe(32); // 28 × 1.15
    expect(typography.sectionTitle.lineHeight).toBe(26); // 22 × 1.2
    expect(typography.cardTitle.lineHeight).toBe(21); // 17 × 1.25
    expect(typography.body.lineHeight).toBe(21); // 15 × 1.4
    expect(typography.bodyStrong.lineHeight).toBe(21);
    expect(typography.bodySecondary.lineHeight).toBe(21);
    expect(typography.price.lineHeight).toBe(22); // 20 × 1.1
    expect(typography.priceLarge.lineHeight).toBe(29); // 26 × 1.1
    // caption, overline and button carried no height in the Dart, and the
    // literal types prove it: reading .lineHeight off them is a type error.
  });

  it("colours each text style from the palette", () => {
    expect(typography.body.color).toBe(colors.ink);
    expect(typography.bodySecondary.color).toBe(colors.inkSecondary);
    expect(typography.caption.color).toBe(colors.inkSecondary);
    expect(typography.overline.color).toBe(colors.inkTertiary);
    expect(typography.button.color).toBe(colors.surface);
  });

  it("freezes the tokens all the way down, not just at the top", () => {
    // A shallow freeze leaves nested offsets and text styles mutable, which is
    // the shape that would actually bite: one screen's tweak reaching the other app.
    expect(Object.isFrozen(colors)).toBe(true);
    expect(Object.isFrozen(radii)).toBe(true);
    expect(Object.isFrozen(spacing)).toBe(true);
    expect(Object.isFrozen(shadows)).toBe(true);
    expect(Object.isFrozen(shadows.card)).toBe(true);
    expect(Object.isFrozen(shadows.card.shadowOffset)).toBe(true);
    expect(Object.isFrozen(typography)).toBe(true);
    expect(Object.isFrozen(typography.body)).toBe(true);

    // Assert the outcome, not the mechanism: whether a write to a frozen
    // object throws or fails silently depends on the strictness of the
    // transform, but the value must be unchanged either way.
    try {
      (shadows.card.shadowOffset as { height: number }).height = 999;
    } catch {
      // strict mode; either behaviour is fine
    }
    try {
      (typography.body as { color: string }).color = "red";
    } catch {
      // strict mode; either behaviour is fine
    }
    expect(shadows.card.shadowOffset.height).toBe(6);
    expect(typography.body.color).toBe(colors.ink);
  });
});

describe("package entry point", () => {
  it("re-exports the tokens from the package root", () => {
    // package.json points main/types at src/index.ts; without it every
    // `import { colors } from "@kaya/ui"` in the apps fails to resolve.
    expect(root.colors).toBe(colors);
    expect(root.radii).toBe(radii);
    expect(root.spacing).toBe(spacing);
    expect(root.typography).toBe(typography);
    expect(root.shadows).toBe(shadows);
    expect(root.minTouch).toBe(minTouch);
  });
});
