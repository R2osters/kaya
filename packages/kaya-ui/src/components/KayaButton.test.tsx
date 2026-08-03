import { fireEvent, render, screen } from "@testing-library/react-native";
import { KayaButton } from "./KayaButton";
import { colors } from "../theme";

describe("KayaButton", () => {
  it("calls onPress when enabled", () => {
    const onPress = jest.fn();
    render(<KayaButton label="Publier" onPress={onPress} />);
    fireEvent.press(screen.getByText("Publier"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress while loading", () => {
    const onPress = jest.fn();
    render(<KayaButton label="Publier" onPress={onPress} loading testID="btn" />);
    fireEvent.press(screen.getByTestId("btn"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("hides the label and shows a spinner while loading", () => {
    render(<KayaButton label="Publier" onPress={jest.fn()} loading testID="btn" />);
    expect(screen.queryByText("Publier")).toBeNull();
    expect(screen.getByTestId("btn-spinner")).toBeTruthy();
  });

  it("renders at half opacity when disabled but not loading", () => {
    render(<KayaButton label="Publier" testID="btn" />);
    expect(screen.getByTestId("btn")).toHaveStyle({ opacity: 0.5 });
  });

  it("keeps full opacity while loading, because the spinner already signals state", () => {
    render(<KayaButton label="Publier" onPress={jest.fn()} loading testID="btn" />);
    expect(screen.getByTestId("btn")).toHaveStyle({ opacity: 1 });
  });

  it("fills with the variant colour and uses white ink", () => {
    render(<KayaButton label="Annuler" onPress={jest.fn()} variant="danger" testID="btn" />);
    expect(screen.getByTestId("btn")).toHaveStyle({ backgroundColor: colors.danger });
    expect(screen.getByText("Annuler")).toHaveStyle({ color: colors.surface });
  });

  it("draws the secondary variant as ink on surface with a border", () => {
    render(<KayaButton label="Plus tard" onPress={jest.fn()} variant="secondary" testID="btn" />);
    expect(screen.getByTestId("btn")).toHaveStyle({ backgroundColor: colors.surface });
    expect(screen.getByText("Plus tard")).toHaveStyle({ color: colors.ink });
  });

  it("never renders below the 44px touch target", () => {
    render(<KayaButton label="OK" onPress={jest.fn()} testID="btn" />);
    expect(screen.getByTestId("btn")).toHaveStyle({ minHeight: 44 });
  });

  it("exposes its disabled state to assistive technology", () => {
    render(<KayaButton label="Publier" testID="btn" />);
    expect(screen.getByTestId("btn")).toBeDisabled();
  });
});
