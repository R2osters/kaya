import { render, screen } from "@testing-library/react-native";
import { KayaSkeleton } from "./KayaSkeleton";
import { radii } from "../theme";

describe("KayaSkeleton", () => {
  it("renders at the requested width, height and radius", () => {
    render(<KayaSkeleton width={120} height={20} radius={8} testID="skeleton" />);
    expect(screen.getByTestId("skeleton")).toHaveStyle({ width: 120, height: 20, borderRadius: 8 });
  });

  it("defaults to a 14px height and the field radius", () => {
    render(<KayaSkeleton testID="skeleton" />);
    expect(screen.getByTestId("skeleton")).toHaveStyle({ height: 14, borderRadius: radii.field });
  });

  it("is not an accessibility element on its own when no label is given", () => {
    // A plain View with no accessibility props is skipped entirely by
    // VoiceOver/TalkBack. This is correct when the skeleton is composed
    // inside a grouping parent (KayaSkeletonCard/List/ListTile) that already
    // announces `busy` once at its own root -- but it means a caller using
    // KayaSkeleton standalone, with no label, gets silence, not a claimed
    // "loading" announcement.
    render(<KayaSkeleton testID="skeleton" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton.props.accessible).toBeFalsy();
    expect(skeleton.props.accessibilityState).toBeUndefined();
  });

  it("announces loading with the caller-supplied label when used standalone", () => {
    render(<KayaSkeleton testID="skeleton" accessibilityLabel="Chargement en cours" />);
    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton.props.accessible).toBe(true);
    expect(skeleton.props.accessibilityRole).toBe("progressbar");
    expect(skeleton.props.accessibilityLabel).toBe("Chargement en cours");
    expect(skeleton.props.accessibilityState).toEqual({ busy: true });
  });
});
