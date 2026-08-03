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

  it("exposes accessibilityState busy so a screen reader announces loading rather than an empty box", () => {
    render(<KayaSkeleton testID="skeleton" />);
    expect(screen.getByTestId("skeleton").props.accessibilityState).toEqual({ busy: true });
  });
});
