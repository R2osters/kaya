import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { KayaScreenHeader } from "./KayaScreenHeader";

describe("KayaScreenHeader", () => {
  it("renders the title under the conventional testID", () => {
    // `${testID}-title` matches what every screen's existing tests already
    // query, so adopting the header did not have to rewrite them.
    render(<KayaScreenHeader title="Notifications" testID="notifications-screen" />);

    expect(screen.getByTestId("notifications-screen-title")).toHaveTextContent("Notifications");
  });

  it("offers the way back and calls it", () => {
    const onBack = jest.fn();
    render(<KayaScreenHeader title="Historique" onBack={onBack} testID="history-screen" />);

    fireEvent.press(screen.getByTestId("history-screen-back"));

    expect(onBack).toHaveBeenCalled();
  });

  it("renders no control at all when there is nowhere to go", () => {
    // A chevron that pops nothing is worse than no chevron: it is a control
    // that visibly does not work. Tab roots and deep-linked screens get none.
    render(<KayaScreenHeader title="Accueil" testID="home-screen" />);

    expect(screen.queryByTestId("home-screen-back")).toBeNull();
  });

  it("does not claim the screen's own testID", () => {
    // Screens pass their root id so the title lands on `${id}-title`; the row
    // re-emitting it made getByTestId(root) ambiguous on every screen.
    render(<KayaScreenHeader title="Connexion" testID="login-screen" />);

    expect(screen.queryByTestId("login-screen")).toBeNull();
    expect(screen.getByTestId("login-screen-header")).toBeTruthy();
  });

  it("keeps a trailing control alongside the title", () => {
    render(
      <KayaScreenHeader
        title="Accueil"
        testID="home-screen"
        right={<Text testID="bell">bell</Text>}
      />,
    );

    expect(screen.getByTestId("bell")).toBeTruthy();
  });
});
