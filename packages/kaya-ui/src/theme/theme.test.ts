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

  it("freezes the tokens so a screen cannot mutate them for everyone", () => {
    expect(Object.isFrozen(colors)).toBe(true);
    expect(Object.isFrozen(radii)).toBe(true);
  });
});
