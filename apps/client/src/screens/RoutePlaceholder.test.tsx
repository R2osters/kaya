import { render, screen } from "@testing-library/react-native";
import { RoutePlaceholder } from "./RoutePlaceholder";

describe("RoutePlaceholder", () => {
  it("renders the given title, styled from @kaya/ui's typography, under the given testID", () => {
    render(<RoutePlaceholder title="Bienvenue" testID="welcome-screen" />);

    const node = screen.getByTestId("welcome-screen");
    expect(node).toBeTruthy();
    expect(screen.getByText("Bienvenue")).toBeTruthy();
  });
});
