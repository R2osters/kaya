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

  it("carries the error on the input itself, not only in a separate node", () => {
    // React Native has no aria-describedby: an error rendered beside the field
    // is a node a screen reader only meets by chance. The person who most needs
    // to know the field is wrong is the least likely to swipe onto it.
    render(
      <KayaTextField
        label="Téléphone"
        hint="+233 20 123 4567"
        value="abc"
        onChangeText={jest.fn()}
        error="Numéro invalide"
        testID="field"
      />,
    );
    const input = screen.getByTestId("field-input");
    expect(input.props.accessibilityLabel).toBe("Téléphone");
    expect(input.props.accessibilityHint).toBe("Numéro invalide");
  });

  it("falls back to the hint when the field is valid", () => {
    render(
      <KayaTextField
        label="Téléphone"
        hint="+233 20 123 4567"
        value="+233201234567"
        onChangeText={jest.fn()}
        testID="field"
      />,
    );
    expect(screen.getByTestId("field-input").props.accessibilityHint).toBe("+233 20 123 4567");
  });

  it("announces the error through a live region, since role=alert alone is silent here", () => {
    render(
      <KayaTextField value="" onChangeText={jest.fn()} error="Champ requis" testID="field" />,
    );
    const message = screen.getByTestId("field-error");
    expect(message.props.accessibilityLiveRegion).toBe("polite");
    expect(message.props.accessibilityRole).toBe("alert");
  });

  it("reports a read-only field as disabled to assistive technology", () => {
    render(
      <KayaTextField value="fixe" onChangeText={jest.fn()} editable={false} testID="field" />,
    );
    expect(screen.getByTestId("field-input").props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });
});
