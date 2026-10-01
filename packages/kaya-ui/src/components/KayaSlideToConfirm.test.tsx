import { fireEvent, render, screen } from "@testing-library/react-native";
import { KayaSlideToConfirm } from "./KayaSlideToConfirm";

describe("KayaSlideToConfirm", () => {
  it("shows what confirming does", () => {
    render(<KayaSlideToConfirm label="Colis récupéré" onConfirm={jest.fn()} testID="action" />);

    expect(screen.getByTestId("action")).toHaveTextContent("Colis récupéré");
  });

  it("does not confirm on its own", () => {
    // The whole point: this control exists because a large tap target
    // advances a delivery by accident in a jacket pocket.
    const onConfirm = jest.fn();
    render(<KayaSlideToConfirm label="Livré" onConfirm={onConfirm} testID="action" />);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms through the accessibility action", () => {
    // The gesture is invisible to a screen reader, which gets a plain
    // activate instead: the protection is against a pocket, not against a
    // user who has deliberately asked their phone to press this.
    const onConfirm = jest.fn();
    render(<KayaSlideToConfirm label="Livré" onConfirm={onConfirm} testID="action" />);

    fireEvent(screen.getByTestId("action"), "accessibilityAction", {
      nativeEvent: { actionName: "activate" },
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("ignores the accessibility action while disabled", () => {
    const onConfirm = jest.fn();
    render(
      <KayaSlideToConfirm label="Livré" onConfirm={onConfirm} disabled testID="action" />,
    );

    fireEvent(screen.getByTestId("action"), "accessibilityAction", {
      nativeEvent: { actionName: "activate" },
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("reports being disabled rather than merely looking it", () => {
    render(<KayaSlideToConfirm label="Livré" onConfirm={jest.fn()} disabled testID="action" />);

    expect(screen.getByTestId("action").props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it("renders a thumb to drag", () => {
    render(<KayaSlideToConfirm label="En route" onConfirm={jest.fn()} testID="action" />);

    expect(screen.getByTestId("action-thumb")).toBeTruthy();
  });

  it("keeps the same contract in the hold variant", () => {
    // 1m is an alternative to the slider, not a second component: same label,
    // same callback, same accessibility route.
    const onConfirm = jest.fn();
    render(
      <KayaSlideToConfirm
        label="Livré"
        onConfirm={onConfirm}
        variant="hold"
        testID="action"
      />,
    );

    fireEvent(screen.getByTestId("action"), "accessibilityAction", {
      nativeEvent: { actionName: "activate" },
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("action")).toHaveTextContent("Livré");
  });

  it("carries the caller's hint for how to operate it", () => {
    render(
      <KayaSlideToConfirm
        label="Livré"
        onConfirm={jest.fn()}
        accessibilityHint="Faites glisser pour confirmer"
        testID="action"
      />,
    );

    expect(screen.getByTestId("action").props.accessibilityHint).toBe(
      "Faites glisser pour confirmer",
    );
  });
});
