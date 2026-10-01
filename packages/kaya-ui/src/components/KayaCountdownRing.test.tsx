import { render, screen } from "@testing-library/react-native";
import { colors } from "../theme";
import { KayaCountdownRing } from "./KayaCountdownRing";

describe("KayaCountdownRing", () => {
  it("shows the seconds left", () => {
    render(<KayaCountdownRing seconds={12} total={15} testID="ring" />);

    expect(screen.getByTestId("ring-value")).toHaveTextContent("12");
  });

  it("never shows a negative count", () => {
    // A socket message arriving after expiry must not render "-3".
    render(<KayaCountdownRing seconds={-3} total={15} testID="ring" />);

    expect(screen.getByTestId("ring-value")).toHaveTextContent("0");
  });

  it("is amber while there is time", () => {
    render(<KayaCountdownRing seconds={12} total={15} testID="ring" />);

    expect(screen.getByTestId("ring-value")).toHaveStyle({ color: colors.amber });
  });

  it("turns danger in the last five seconds", () => {
    // The colour is what carries the urgency: the geometry only shrinks.
    render(<KayaCountdownRing seconds={4} total={15} testID="ring" />);

    expect(screen.getByTestId("ring-value")).toHaveStyle({ color: colors.danger });
  });

  it("empties its ring as the count falls", () => {
    const { rerender } = render(<KayaCountdownRing seconds={15} total={15} testID="ring" />);
    const full = screen.getByTestId("ring").props.style;

    rerender(<KayaCountdownRing seconds={1} total={15} testID="ring" />);
    const nearlyEmpty = screen.getByTestId("ring").props.style;

    expect(JSON.stringify(full)).not.toBe(JSON.stringify(nearlyEmpty));
  });

  it("survives a zero total rather than dividing by it", () => {
    render(<KayaCountdownRing seconds={0} total={0} testID="ring" />);

    expect(screen.getByTestId("ring-value")).toHaveTextContent("0");
  });

  it("carries the caller's label, since a bare number says nothing aloud", () => {
    render(
      <KayaCountdownRing
        seconds={9}
        total={15}
        accessibilityLabel="Expire dans 9 secondes"
        testID="ring"
      />,
    );

    expect(screen.getByLabelText("Expire dans 9 secondes")).toBeTruthy();
  });
});
