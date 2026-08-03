import { render, screen } from "@testing-library/react-native";
import { KayaSkeletonListTile } from "./KayaSkeletonListTile";

// The root deliberately carries importantForAccessibility="no-hide-descendants"
// (see KayaSkeletonListTile.tsx) so a screen reader groups the row into one
// node. React Native Testing Library treats that prop as "hidden from
// accessibility" and excludes the whole subtree from queries by default, so
// every lookup below opts back in with includeHiddenElements.
const hidden = { includeHiddenElements: true };

describe("KayaSkeletonListTile", () => {
  it("renders the leading avatar circle, both text lines and the trailing chip", () => {
    render(<KayaSkeletonListTile testID="tile" />);
    // Leading avatar: 44px circle (radius = half the diameter).
    expect(screen.getByTestId("tile-row-avatar", hidden)).toHaveStyle({ width: 44, height: 44, borderRadius: 22 });
    // Title line stretches to fill; subtitle line is a fixed, shorter width.
    expect(screen.getByTestId("tile-row-line-1", hidden)).toHaveStyle({ height: 14 });
    expect(screen.getByTestId("tile-row-line-2", hidden)).toHaveStyle({ width: 120, height: 12 });
    // Trailing chip.
    expect(screen.getByTestId("tile-row-chip", hidden)).toHaveStyle({ width: 48, height: 20 });
  });

  it("announces busy once, at its own root", () => {
    render(<KayaSkeletonListTile testID="tile" />);
    expect(screen.getByTestId("tile", hidden).props.accessibilityState).toEqual({ busy: true });
  });
});
