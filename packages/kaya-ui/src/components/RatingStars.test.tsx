import { fireEvent, render, screen } from "@testing-library/react-native";
import { RatingStars } from "./RatingStars";

const kinds = () => screen.getAllByTestId(/^star-\d$/).map((s) => s.props.accessibilityLabel);

describe("RatingStars", () => {
  it("fills to the rounded value", () => {
    render(<RatingStars value={4} />);
    expect(kinds()).toEqual(["filled", "filled", "filled", "filled", "outline"]);
  });

  it("rounds a .5 rating up rather than showing a half star", () => {
    // Documents the ported rule, not an intent: filled is `i < Math.round(value)`,
    // so 4.5 rounds to 5 and the half-star branch cannot fire for exactly .5.
    render(<RatingStars value={4.5} />);
    expect(kinds()).toEqual(["filled", "filled", "filled", "filled", "filled"]);
  });

  it("shows a half star for a fraction between .25 and .5", () => {
    render(<RatingStars value={4.3} />);
    expect(kinds()).toEqual(["filled", "filled", "filled", "filled", "half"]);
  });

  it("puts the half-star cutoff exactly at .25, inclusive", () => {
    // The rule is `value - i >= 0.25`. Pinning both sides of the boundary is
    // what stops a later refactor from turning >= into > unnoticed.
    render(<RatingStars value={4.25} />);
    expect(kinds()[4]).toBe("half");

    screen.unmount();
    render(<RatingStars value={4.24} />);
    expect(kinds()[4]).toBe("outline");
  });

  it("renders all outlines at zero and all fills at the maximum", () => {
    render(<RatingStars value={0} />);
    expect(kinds()).toEqual(["outline", "outline", "outline", "outline", "outline"]);

    screen.unmount();
    render(<RatingStars value={5} />);
    expect(kinds()).toEqual(["filled", "filled", "filled", "filled", "filled"]);
  });

  it("does not render past count when the value exceeds it", () => {
    render(<RatingStars value={9} />);
    expect(kinds()).toHaveLength(5);
    expect(kinds().every((k) => k === "filled")).toBe(true);
  });

  it("is read-only unless onRate is supplied", () => {
    render(<RatingStars value={3} />);
    expect(screen.getByTestId("star-0")).not.toBeDisabled();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("reports a 1-based score when interactive", () => {
    const onRate = jest.fn();
    render(<RatingStars value={0} onRate={onRate} />);
    fireEvent.press(screen.getByTestId("star-3"));
    expect(onRate).toHaveBeenCalledWith(4);
  });
});
