import { render, screen } from "@testing-library/react-native";
import { KayaSkeletonCard } from "./KayaSkeletonCard";

// The root deliberately carries importantForAccessibility="no-hide-descendants"
// (see KayaSkeletonCard.tsx) so a screen reader groups the card into one
// node. React Native Testing Library treats that prop as "hidden from
// accessibility" and excludes the whole subtree from queries by default, so
// every lookup below opts back in with includeHiddenElements.
const hidden = { includeHiddenElements: true };

describe("KayaSkeletonCard", () => {
  it("renders a title line, three body lines of decreasing width, and a footer row", () => {
    render(<KayaSkeletonCard testID="card" />);
    expect(screen.getByTestId("card-title", hidden)).toHaveStyle({ width: 160, height: 18 });
    expect(screen.getByTestId("card-body-1", hidden)).toHaveStyle({ height: 14 });
    expect(screen.getByTestId("card-body-2", hidden)).toHaveStyle({ height: 14 });
    expect(screen.getByTestId("card-body-3", hidden)).toHaveStyle({ width: 200, height: 14 });
    expect(screen.getByTestId("card-footer-1", hidden)).toHaveStyle({ width: 80, height: 32 });
    expect(screen.getByTestId("card-footer-2", hidden)).toHaveStyle({ width: 80, height: 32 });
  });

  it("announces the caller's label once, at its own root", () => {
    render(<KayaSkeletonCard accessibilityLabel="Chargement" testID="card" />);
    const root = screen.getByTestId("card", hidden);
    expect(root.props.accessible).toBe(true);
    expect(root.props.accessibilityLabel).toBe("Chargement");
    expect(root.props.accessibilityState).toEqual({ busy: true });
  });

  it("is not an accessibility element at all without a label", () => {
    // An `accessible` node with nothing to read is worse than none: a screen
    // reader focuses it and says nothing, which is indistinguishable from an
    // empty list. Copy has to come from the caller's i18n.
    render(<KayaSkeletonCard testID="card" />);
    const root = screen.getByTestId("card", hidden);
    expect(root.props.accessible).toBe(false);
    expect(root.props.accessibilityState).toBeUndefined();
  });
});
