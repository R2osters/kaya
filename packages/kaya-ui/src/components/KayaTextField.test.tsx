import { fireEvent, render, screen } from "@testing-library/react-native";
import { KayaTextField } from "./KayaTextField";
import { colors } from "../theme";

describe("KayaTextField", () => {
  it("renders its label, hint and value", () => {
    render(
      <KayaTextField
        label="Téléphone"
        hint="+233 20 000 0000"
        value="0240000000"
        onChangeText={jest.fn()}
        testID="field"
      />,
    );
    expect(screen.getByText("Téléphone")).toBeTruthy();
    expect(screen.getByPlaceholderText("+233 20 000 0000")).toBeTruthy();
    expect(screen.getByDisplayValue("0240000000")).toBeTruthy();
  });

  it("renders with no label when none is given", () => {
    render(<KayaTextField value="" onChangeText={jest.fn()} testID="field" />);
    expect(screen.queryByTestId("field-label")).toBeNull();
  });

  it("calls onChangeText as the user types", () => {
    const onChangeText = jest.fn();
    render(<KayaTextField value="" onChangeText={onChangeText} testID="field" />);
    fireEvent.changeText(screen.getByTestId("field-input"), "Ama");
    expect(onChangeText).toHaveBeenCalledWith("Ama");
  });

  it("shows its error message and marks the field invalid", () => {
    render(<KayaTextField value="wrong" onChangeText={jest.fn()} error="Numéro invalide" testID="field" />);
    const error = screen.getByText("Numéro invalide");
    expect(error).toBeTruthy();
    // The error must be announced, not just rendered — accessibilityRole
    // "alert" is how React Native surfaces that to a screen reader, since RN
    // (unlike Flutter/web ARIA) has no `invalid` key on accessibilityState.
    expect(error.props.accessibilityRole).toBe("alert");
    expect(screen.getByTestId("field-box")).toHaveStyle({ borderColor: colors.danger });
  });

  it("renders no error and a plain border when error is not given", () => {
    render(<KayaTextField value="" onChangeText={jest.fn()} testID="field" />);
    expect(screen.queryByTestId("field-error")).toBeNull();
    expect(screen.getByTestId("field-box")).toHaveStyle({ borderColor: colors.border });
  });

  it("respects editable={false}", () => {
    render(<KayaTextField value="Ama" onChangeText={jest.fn()} editable={false} testID="field" />);
    expect(screen.getByTestId("field-input")).toBeDisabled();
  });

  it("hands the tertiary ink colour to a function prefix icon", () => {
    const seen: string[] = [];
    const icon = (color: string) => {
      seen.push(color);
      return null;
    };
    render(<KayaTextField value="" onChangeText={jest.fn()} prefixIcon={icon} testID="field" />);
    expect(seen).toEqual([colors.inkTertiary]);
  });
});
