import { render, screen } from "@testing-library/react-native";
import { Text, View } from "react-native";
import { colors } from "../theme";
import {
  KayaGlassBar,
  hasBlurProvider,
  registerBlurProvider,
  resetBlurProvider,
  type BlurSurfaceProps,
} from "./KayaGlassBar";

afterEach(() => {
  resetBlurProvider();
});

describe("KayaGlassBar", () => {
  it("renders its content", () => {
    render(
      <KayaGlassBar testID="bar">
        <Text>Où allez-vous ?</Text>
      </KayaGlassBar>,
    );

    expect(screen.getByText("Où allez-vous ?")).toBeTruthy();
  });

  it("falls back to an opaque surface when no blur is registered", () => {
    // The documented fallback, and the one that ships today: expo-blur is a
    // native module, and blur over a moving map is expensive on exactly the
    // hardware this app targets.
    render(
      <KayaGlassBar testID="bar">
        <Text>contenu</Text>
      </KayaGlassBar>,
    );

    expect(hasBlurProvider()).toBe(false);
    expect(screen.getByTestId("bar")).toHaveStyle({ backgroundColor: colors.surface });
  });

  it("uses a registered blur implementation once a host app plugs one in", () => {
    const Blur = ({ intensity, style }: BlurSurfaceProps) => (
      <View testID={`blur-${intensity}`} style={style} />
    );
    registerBlurProvider(Blur);

    render(
      <KayaGlassBar testID="bar">
        <Text>contenu</Text>
      </KayaGlassBar>,
    );

    // The intensity the design specifies, passed through rather than left to
    // whatever the provider defaults to.
    expect(screen.getByTestId("blur-40")).toBeTruthy();
    expect(screen.getByText("contenu")).toBeTruthy();
  });

  it("stops using a provider once it is reset", () => {
    registerBlurProvider(({ intensity, style }: BlurSurfaceProps) => (
      <View testID={`blur-${intensity}`} style={style} />
    ));
    resetBlurProvider();

    render(
      <KayaGlassBar testID="bar">
        <Text>contenu</Text>
      </KayaGlassBar>,
    );

    expect(screen.queryByTestId("blur-40")).toBeNull();
  });

  it("takes the caller's radius", () => {
    render(
      <KayaGlassBar radius={999} testID="bar">
        <Text>contenu</Text>
      </KayaGlassBar>,
    );

    expect(screen.getByTestId("bar")).toHaveStyle({ borderRadius: 999 });
  });
});
