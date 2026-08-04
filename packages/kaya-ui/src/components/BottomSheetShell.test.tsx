import { fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { BottomSheetShell } from "./BottomSheetShell";
import { colors } from "../theme";

describe("BottomSheetShell", () => {
  it("renders children when visible", () => {
    render(
      <BottomSheetShell visible onClose={jest.fn()} testID="sheet">
        <Text>contenu</Text>
      </BottomSheetShell>,
    );
    expect(screen.getByText("contenu")).toBeTruthy();
  });

  it("renders nothing when not visible", () => {
    render(
      <BottomSheetShell visible={false} onClose={jest.fn()} testID="sheet">
        <Text>contenu</Text>
      </BottomSheetShell>,
    );
    expect(screen.queryByText("contenu")).toBeNull();
    expect(screen.queryByTestId("sheet")).toBeNull();
  });

  it("renders the optional title", () => {
    render(
      <BottomSheetShell visible onClose={jest.fn()} title="Filtres" testID="sheet">
        <Text>contenu</Text>
      </BottomSheetShell>,
    );
    expect(screen.getByText("Filtres")).toBeTruthy();
  });

  it("omits the title block when none is given", () => {
    render(
      <BottomSheetShell visible onClose={jest.fn()} testID="sheet">
        <Text>contenu</Text>
      </BottomSheetShell>,
    );
    expect(screen.queryByTestId("sheet-title")).toBeNull();
  });

  it("calls onClose when the backdrop is pressed", () => {
    const onClose = jest.fn();
    render(
      <BottomSheetShell visible onClose={onClose} testID="sheet">
        <Text>contenu</Text>
      </BottomSheetShell>,
    );
    fireEvent.press(screen.getByTestId("sheet-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Android hardware back", () => {
    // The Flutter sheet inherited both backdrop-press and hardware-back
    // dismissal from showModalBottomSheet; React Native wires onRequestClose
    // explicitly, which is what Modal invokes when the back button is
    // pressed. Missing this traps an Android user inside the sheet.
    const onClose = jest.fn();
    render(
      <BottomSheetShell visible onClose={onClose} testID="sheet">
        <Text>contenu</Text>
      </BottomSheetShell>,
    );
    fireEvent(screen.getByTestId("sheet"), "requestClose");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when the sheet's own content is pressed", () => {
    // The backdrop sits behind the sheet, so a tap on a form inside it must not
    // dismiss the whole thing — the classic way a bottom sheet becomes unusable.
    const onClose = jest.fn();
    const onPress = jest.fn();
    render(
      <BottomSheetShell visible onClose={onClose} testID="sheet">
        <Pressable testID="inner" onPress={onPress}>
          <Text>Confirmer</Text>
        </Pressable>
      </BottomSheetShell>,
    );

    fireEvent.press(screen.getByTestId("inner"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("dims the screen behind the sheet with the scrim token", () => {
    // Flutter's showModalBottomSheet gave a barrier colour for free; without
    // one here the sheet floats over an undimmed screen.
    render(
      <BottomSheetShell visible onClose={jest.fn()} testID="sheet">
        <Text>contenu</Text>
      </BottomSheetShell>,
    );
    expect(screen.getByTestId("sheet-overlay")).toHaveStyle({ backgroundColor: colors.scrim });
  });

  it("labels the backdrop as a button with the caller-supplied dismiss label", () => {
    // A screen reader must not announce an unlabeled button covering the
    // whole screen; the label is caller-supplied, never hardcoded here.
    render(
      <BottomSheetShell visible onClose={jest.fn()} dismissAccessibilityLabel="Fermer" testID="sheet">
        <Text>contenu</Text>
      </BottomSheetShell>,
    );
    const backdrop = screen.getByTestId("sheet-backdrop");
    expect(backdrop.props.accessible).toBe(true);
    expect(backdrop.props.accessibilityRole).toBe("button");
    expect(backdrop.props.accessibilityLabel).toBe("Fermer");
  });

  it("does not present an unlabelled full-screen button when no label is given", () => {
    // "button", announced over the whole screen with no idea what it does, is
    // worse than a backdrop assistive technology simply skips.
    render(
      <BottomSheetShell visible onClose={jest.fn()} testID="sheet">
        <Text>contenu</Text>
      </BottomSheetShell>,
    );
    const backdrop = screen.getByTestId("sheet-backdrop");
    expect(backdrop.props.accessible).toBe(false);
    expect(backdrop.props.accessibilityRole).toBeUndefined();
  });

  it("marks the presented content as a modal so focus cannot escape behind it", () => {
    render(
      <BottomSheetShell visible onClose={jest.fn()} testID="sheet">
        <Text>contenu</Text>
      </BottomSheetShell>,
    );
    expect(screen.getByTestId("sheet-overlay").props.accessibilityViewIsModal).toBe(true);
  });

  it("caps the sheet's height instead of letting it grow past the top of the screen", () => {
    render(
      <BottomSheetShell visible onClose={jest.fn()} testID="sheet">
        <Text>contenu</Text>
      </BottomSheetShell>,
    );
    const style = screen.getByTestId("sheet-panel").props.style;
    const flattened = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(typeof flattened.maxHeight).toBe("number");
    expect(flattened.maxHeight).toBeGreaterThan(0);
  });

  it("keeps tall content reachable by scrolling instead of overflowing off-screen", () => {
    // No maxHeight cap plus React Native's default flexShrink: 0 is exactly
    // how an address or offer list pushes the grab handle and title off the
    // top of the screen with no way back -- the content must be scrollable,
    // not merely capped.
    render(
      <BottomSheetShell visible onClose={jest.fn()} testID="sheet">
        <Text>contenu</Text>
      </BottomSheetShell>,
    );
    expect(screen.getByText("contenu")).toBeTruthy();
    expect(screen.getByTestId("sheet-content").props.showsVerticalScrollIndicator).toBe(false);
  });
});
