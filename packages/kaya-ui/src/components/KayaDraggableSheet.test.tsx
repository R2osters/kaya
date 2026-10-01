import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { KayaDraggableSheet } from "./KayaDraggableSheet";

describe("KayaDraggableSheet", () => {
  it("renders its content", () => {
    render(
      <KayaDraggableSheet testID="sheet">
        <Text>demandes</Text>
      </KayaDraggableSheet>,
    );

    expect(screen.getByText("demandes")).toBeTruthy();
    expect(screen.getByTestId("sheet")).toBeTruthy();
  });

  it("exposes a grab handle", () => {
    render(
      <KayaDraggableSheet testID="sheet">
        <Text>demandes</Text>
      </KayaDraggableSheet>,
    );

    expect(screen.getByTestId("sheet-handle")).toBeTruthy();
  });

  it("gives assistive technology a way to resize it", () => {
    // A drag gesture with no accessibility action behind it is a control that
    // does not exist for part of the audience.
    const onSnap = jest.fn();
    render(
      <KayaDraggableSheet
        onSnap={onSnap}
        handleAccessibilityLabel="Demandes proches"
        testID="sheet"
      >
        <Text>demandes</Text>
      </KayaDraggableSheet>,
    );

    const handle = screen.getByLabelText("Demandes proches");
    expect(handle.props.accessibilityRole).toBe("adjustable");

    fireEvent(handle, "accessibilityAction", { nativeEvent: { actionName: "activate" } });

    expect(onSnap).toHaveBeenCalledWith("expanded");
  });

  it("reports each detent as it is reached", () => {
    const onSnap = jest.fn();
    render(
      <KayaDraggableSheet onSnap={onSnap} handleAccessibilityLabel="Demandes" testID="sheet">
        <Text>demandes</Text>
      </KayaDraggableSheet>,
    );

    const handle = screen.getByLabelText("Demandes");
    fireEvent(handle, "accessibilityAction", { nativeEvent: { actionName: "activate" } });
    fireEvent(handle, "accessibilityAction", { nativeEvent: { actionName: "activate" } });

    expect(onSnap.mock.calls.map(([detent]) => detent)).toEqual(["expanded", "collapsed"]);
  });

  it("starts collapsed, so the map above it stays the larger half", () => {
    const onSnap = jest.fn();
    render(
      <KayaDraggableSheet onSnap={onSnap} testID="sheet">
        <Text>demandes</Text>
      </KayaDraggableSheet>,
    );

    // Nothing reported before the first interaction: the resting position is
    // not an event, it is where the sheet already is.
    expect(onSnap).not.toHaveBeenCalled();
  });
});
