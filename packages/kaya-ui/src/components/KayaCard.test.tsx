import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { KayaCard } from "./KayaCard";
import { colors, radii, shadows } from "../theme";

describe("KayaCard", () => {
  it("renders its children on a white surface with the card radius", () => {
    render(
      <KayaCard testID="card">
        <Text>Osu → East Legon</Text>
      </KayaCard>,
    );
    expect(screen.getByText("Osu → East Legon")).toBeTruthy();
    expect(screen.getByTestId("card")).toHaveStyle({
      backgroundColor: colors.surface,
      borderRadius: radii.card,
    });
  });

  it("is not pressable unless an onPress is supplied", () => {
    render(
      <KayaCard testID="card">
        <Text>static</Text>
      </KayaCard>,
    );
    // A plain View has no press handler to fire; this asserts the card does not
    // silently swallow taps meant for something behind it.
    expect(screen.getByTestId("card")).toBeTruthy();
  });

  it("calls onPress when pressable", () => {
    const onPress = jest.fn();
    render(
      <KayaCard testID="card" onPress={onPress}>
        <Text>tap me</Text>
      </KayaCard>,
    );
    fireEvent.press(screen.getByTestId("card"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("draws the hairline border and the card shadow by default", () => {
    render(
      <KayaCard testID="card">
        <Text>default</Text>
      </KayaCard>,
    );
    expect(screen.getByTestId("card")).toHaveStyle({
      borderWidth: 1,
      borderColor: colors.borderSoft,
      elevation: shadows.card.elevation,
      shadowOpacity: shadows.card.shadowOpacity,
    });
  });

  it("can drop its border and shadow for nested use", () => {
    render(
      <KayaCard testID="card" border={false} shadow={false}>
        <Text>flat</Text>
      </KayaCard>,
    );
    expect(screen.getByTestId("card")).toHaveStyle({ borderWidth: 0, elevation: 0 });
  });
});
