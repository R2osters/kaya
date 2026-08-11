import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { KayaPressable } from "./KayaPressable";

describe("KayaPressable", () => {
  it("renders its children and forwards presses", () => {
    const onPress = jest.fn();
    render(
      <KayaPressable onPress={onPress} testID="surface">
        <Text>contenu</Text>
      </KayaPressable>,
    );

    fireEvent.press(screen.getByTestId("surface"));

    expect(screen.getByText("contenu")).toBeTruthy();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("forwards pressIn and pressOut, where the feedback lives", () => {
    // The sink fires on press-in -- feedback on release only reads as dead.
    // Under jest the reanimated mock applies values synchronously, so what is
    // asserted here is the wiring, not the curve.
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    render(
      <KayaPressable onPress={jest.fn()} onPressIn={onPressIn} onPressOut={onPressOut} testID="surface">
        <Text>contenu</Text>
      </KayaPressable>,
    );

    fireEvent(screen.getByTestId("surface"), "pressIn");
    fireEvent(screen.getByTestId("surface"), "pressOut");

    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });

  it("ignores presses when disabled", () => {
    const onPress = jest.fn();
    render(
      <KayaPressable onPress={onPress} disabled testID="surface">
        <Text>contenu</Text>
      </KayaPressable>,
    );

    fireEvent.press(screen.getByTestId("surface"));

    expect(onPress).not.toHaveBeenCalled();
  });

  it("accepts the noScale escape hatch without breaking the press", () => {
    const onPress = jest.fn();
    render(
      <KayaPressable onPress={onPress} noScale testID="surface">
        <Text>contenu</Text>
      </KayaPressable>,
    );

    fireEvent(screen.getByTestId("surface"), "pressIn");
    fireEvent.press(screen.getByTestId("surface"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
