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

  it("announces busy once for the whole list, not once per tile", () => {
    render(<KayaSkeletonList count={4} testID="list" />);
    expect(screen.getByTestId("list", hidden).props.accessibilityState).toEqual({ busy: true });
    // Individual tiles carry no accessibility state of their own — only the
    // list root announces busy, so a screen reader hears "loading" once
    // rather than once per row.
    expect(screen.getByTestId("list-tile-0", hidden).props.accessibilityState).toBeUndefined();
  });
});
