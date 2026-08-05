import { fireEvent, render, screen } from "@testing-library/react-native";
import { RatingStars } from "./RatingStars";

const kinds = () =>
  screen.getAllByTestId(/^row-star-\d$/).map((s) => s.props.accessibilityLabel);

describe("RatingStars", () => {
  it("fills to the rounded value", () => {
    render(<RatingStars value={4} testID="row" />);
    expect(kinds()).toEqual(["filled", "filled", "filled", "filled", "outline"]);
  });

  it("rounds a .5 rating up rather than showing a half star", () => {
    // Documents the ported rule, not an intent: filled is `i < Math.round(value)`,
    // so 4.5 rounds to 5 and the half-star branch cannot fire for exactly .5.
    render(<RatingStars value={4.5} testID="row" />);
    expect(kinds()).toEqual(["filled", "filled", "filled", "filled", "filled"]);
  });

  it("shows a half star for a fraction between .25 and .5", () => {
    render(<RatingStars value={4.3} testID="row" />);
    expect(kinds()).toEqual(["filled", "filled", "filled", "filled", "half"]);
  });

  it("puts the half-star cutoff exactly at .25, inclusive", () => {
    // The rule is `value - i >= 0.25`. Pinning both sides of the boundary is
    // what stops a later refactor from turning >= into > unnoticed.
    render(<RatingStars value={4.25} testID="row" />);
    expect(kinds()[4]).toBe("half");

    screen.unmount();
    render(<RatingStars value={4.24} testID="row" />);
    expect(kinds()[4]).toBe("outline");
  });

  it("renders all outlines at zero and all fills at the maximum", () => {
    render(<RatingStars value={0} testID="row" />);
    expect(kinds()).toEqual(["outline", "outline", "outline", "outline", "outline"]);

    screen.unmount();
    render(<RatingStars value={5} testID="row" />);
    expect(kinds()).toEqual(["filled", "filled", "filled", "filled", "filled"]);
  });

  it("does not render past count when the value exceeds it", () => {
    render(<RatingStars value={9} testID="row" />);
    expect(kinds()).toHaveLength(5);
    expect(kinds().every((k) => k === "filled")).toBe(true);
  });

  it("is read-only unless onRate is supplied", () => {
    render(<RatingStars value={3} testID="row" />);
    expect(screen.getByTestId("row-star-0")).not.toBeDisabled();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("reports a 1-based score when interactive", () => {
    const onRate = jest.fn();
    render(<RatingStars value={0} onRate={onRate} testID="row" />);
    fireEvent.press(screen.getByTestId("row-star-3"));
    expect(onRate).toHaveBeenCalledWith(4);
  });

  it("scopes each star's testID to the instance's own testID, so two RatingStars on one screen don't collide", () => {
    // Before the fix, every star was "star-{i}" regardless of the row's own
    // testID -- render two rows on one screen (the design-system showcase
    // does exactly this) and getByTestId("star-0") was ambiguous between
    // them. Scoping to the instance testID is what makes both rows
    // independently addressable.
    render(
      <>
        <RatingStars value={5} testID="rating-one" />
        <RatingStars value={0} testID="rating-two" />
      </>,
    );

    expect(screen.getByTestId("rating-one-star-0").props.accessibilityLabel).toBe("filled");
    expect(screen.getByTestId("rating-two-star-0").props.accessibilityLabel).toBe("outline");
    expect(screen.queryByTestId("star-0")).toBeNull();
  });

  it("gives its stars no testID at all when the row has none", () => {
    // Falling back to a bare "star-{i}" would leave the collision reachable
    // for the default case: two unnamed rows in, say, a delivery history
    // would both answer to "star-0". A row that wants addressable stars has
    // to name itself.
    render(
      <>
        <RatingStars value={5} />
        <RatingStars value={0} />
      </>,
    );

    expect(screen.queryByTestId("star-0")).toBeNull();
    // The stars still render and still describe themselves to assistive
    // technology; only the test handle is withheld.
    expect(screen.getAllByLabelText("filled")).toHaveLength(5);
    expect(screen.getAllByLabelText("outline")).toHaveLength(5);
  });
});
