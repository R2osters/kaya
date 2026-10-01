import { render, screen } from "@testing-library/react-native";
import { KayaCountBadge } from "./KayaCountBadge";

describe("KayaCountBadge", () => {
  it("renders nothing at zero", () => {
    render(<KayaCountBadge count={0} testID="badge" />);

    expect(screen.queryByTestId("badge")).toBeNull();
  });

  it("renders nothing for a negative count", () => {
    render(<KayaCountBadge count={-1} testID="badge" />);

    expect(screen.queryByTestId("badge")).toBeNull();
  });

  it("shows the count", () => {
    render(<KayaCountBadge count={3} testID="badge" />);

    expect(screen.getByTestId("badge")).toHaveTextContent("3");
  });

  it("caps the label past the maximum", () => {
    render(<KayaCountBadge count={42} testID="badge" />);

    expect(screen.getByTestId("badge")).toHaveTextContent("9+");
  });

  it("honours a caller-supplied maximum", () => {
    render(<KayaCountBadge count={42} max={20} testID="badge" />);

    expect(screen.getByTestId("badge")).toHaveTextContent("20+");
  });

  it("survives the count changing while mounted", () => {
    // The pop fires from an effect on every change; under the reanimated mock
    // the sequence resolves synchronously, so what this pins is that the
    // change does not throw and the new count is what is drawn.
    const { rerender } = render(<KayaCountBadge count={2} testID="badge" />);
    rerender(<KayaCountBadge count={3} testID="badge" />);

    expect(screen.getByTestId("badge")).toHaveTextContent("3");
  });

  it("disappears when the count falls back to zero", () => {
    const { rerender } = render(<KayaCountBadge count={2} testID="badge" />);
    rerender(<KayaCountBadge count={0} testID="badge" />);

    expect(screen.queryByTestId("badge")).toBeNull();
  });

  it("is an accessibility element only when the caller names what it counts", () => {
    // @kaya/ui never hardcodes user-facing copy, and a bare "3" read out next
    // to a bell tells a screen-reader user nothing.
    const { rerender } = render(<KayaCountBadge count={3} testID="badge" />);
    expect(screen.getByTestId("badge").props.accessible).toBe(false);

    rerender(<KayaCountBadge count={3} accessibilityLabel="3 non lus" testID="badge" />);
    expect(screen.getByLabelText("3 non lus")).toBeTruthy();
  });
});
