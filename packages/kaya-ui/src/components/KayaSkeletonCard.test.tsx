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

  it("announces busy once, at its own root", () => {
    render(<KayaSkeletonCard testID="card" />);
    expect(screen.getByTestId("card", hidden).props.accessibilityState).toEqual({ busy: true });
  });
});
