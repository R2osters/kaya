import { fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { BottomSheetShell } from "./BottomSheetShell";

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
});
