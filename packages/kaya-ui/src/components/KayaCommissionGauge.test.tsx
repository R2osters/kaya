import { render, screen } from "@testing-library/react-native";
import { KayaCommissionGauge, type CommissionTier } from "./KayaCommissionGauge";

/** Ghana's ladder, the shape `country_configs` hands back. */
const TIERS: CommissionTier[] = [
  { from: 1, rate: 0.2 },
  { from: 7, rate: 0.15 },
  { from: 11, rate: 0.12 },
  { from: 15, rate: 0.09 },
];

describe("KayaCommissionGauge", () => {
  it("draws one segment per tier", () => {
    render(<KayaCommissionGauge tiers={TIERS} coursesDone={0} testID="gauge" />);

    // Exact ids, not a prefix match: `gauge-tier-1` is a prefix of
    // `gauge-tier-15`, and a loose query here would pass on a gauge that had
    // silently lost a segment.
    expect(screen.getByTestId("gauge-tier-1-active")).toBeTruthy();
    expect(screen.getByTestId("gauge-tier-7")).toBeTruthy();
    expect(screen.getByTestId("gauge-tier-11")).toBeTruthy();
    expect(screen.getByTestId("gauge-tier-15")).toBeTruthy();
  });

  it("marks the first tier active before any delivery", () => {
    // Delivery #1 is charged at 20%: the driver's day starts in tier one, not
    // outside the ladder.
    render(<KayaCommissionGauge tiers={TIERS} coursesDone={0} testID="gauge" />);

    expect(screen.getByTestId("gauge-tier-1-active")).toBeTruthy();
  });

  it("moves the active tier as the day accumulates", () => {
    // Six done means the seventh is next, and the seventh is the 15% tier --
    // the ordinal that matters is the delivery about to happen.
    render(<KayaCommissionGauge tiers={TIERS} coursesDone={6} testID="gauge" />);

    expect(screen.getByTestId("gauge-tier-7-active")).toBeTruthy();
    expect(screen.queryByTestId("gauge-tier-1-active")).toBeNull();
  });

  it("stays on the last tier once past its threshold", () => {
    render(<KayaCommissionGauge tiers={TIERS} coursesDone={40} testID="gauge" />);

    expect(screen.getByTestId("gauge-tier-15-active")).toBeTruthy();
  });

  it("announces itself as a progressbar over the tiers", () => {
    render(
      <KayaCommissionGauge
        tiers={TIERS}
        coursesDone={6}
        accessibilityLabel="Commission dégressive"
        testID="gauge"
      />,
    );

    const gauge = screen.getByLabelText("Commission dégressive");

    expect(gauge.props.accessibilityRole).toBe("progressbar");
    expect(gauge.props.accessibilityValue).toEqual({ min: 0, max: 4, now: 2 });
  });

  it("renders an empty ladder without throwing", () => {
    // The tariff card has not arrived yet: no tiers is a loading state, not a
    // crash.
    render(<KayaCommissionGauge tiers={[]} coursesDone={0} testID="gauge" />);

    expect(screen.getByTestId("gauge")).toBeTruthy();
  });
});
