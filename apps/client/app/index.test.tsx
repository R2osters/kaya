import { KayaI18nProvider } from "@kaya/ui";
import { render, screen } from "@testing-library/react-native";
import IndexScreen from "./index";

describe("IndexScreen", () => {
  it("renders a Text styled from @kaya/ui's typography tokens and a KayaButton, proving the workspace resolves", () => {
    render(
      <KayaI18nProvider>
        <IndexScreen />
      </KayaI18nProvider>,
    );

    // French copy comes from @kaya/core's i18n resources (KayaI18nProvider
    // defaults to "fr") -- a broken Metro/Jest workspace symlink resolution
    // fails this test in CI rather than only showing up on a device.
    expect(screen.getByText("Livrez tout, partout")).toBeTruthy();
    expect(screen.getByTestId("continue-button")).toBeTruthy();
  });
});
