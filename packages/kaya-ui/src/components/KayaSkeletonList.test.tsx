import { render, screen } from "@testing-library/react-native";
import { KayaSkeletonList } from "./KayaSkeletonList";

// The root deliberately carries importantForAccessibility="no-hide-descendants"
// (see KayaSkeletonList.tsx) so a screen reader groups the whole list into
// one node. React Native Testing Library treats that prop as "hidden from
// accessibility" and excludes the whole subtree from queries by default, so
// every lookup below opts back in with includeHiddenElements.
const hidden = { includeHiddenElements: true };

describe("KayaSkeletonList", () => {
  it("renders exactly `count` tiles", () => {
    render(<KayaSkeletonList count={6} testID="list" />);
    expect(screen.getAllByTestId(/^list-tile-\d+-avatar$/, hidden)).toHaveLength(6);
  });

  it("defaults to a sensible count", () => {
    render(<KayaSkeletonList testID="list" />);
    expect(screen.getAllByTestId(/^list-tile-\d+-avatar$/, hidden)).toHaveLength(4);
  });

  it("announces the caller's label once, at its own root", () => {
    render(<KayaSkeletonList accessibilityLabel="Chargement" testID="list" />);
    const root = screen.getByTestId("list", hidden);
    expect(root.props.accessible).toBe(true);
    expect(root.props.accessibilityLabel).toBe("Chargement");
    expect(root.props.accessibilityState).toEqual({ busy: true });
  });

  it("is not an accessibility element at all without a label", () => {
    // An `accessible` node with nothing to read is worse than none: a screen
    // reader focuses it and says nothing, which is indistinguishable from an
    // empty list. Copy has to come from the caller's i18n.
    render(<KayaSkeletonList testID="list" />);
    const root = screen.getByTestId("list", hidden);
    expect(root.props.accessible).toBe(false);
    expect(root.props.accessibilityState).toBeUndefined();
  });
});
