import { VEHICLE_TYPES, resources } from "@kaya/core";
import { KayaI18nProvider } from "@kaya/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import RegisterScreen from "./register";

const mockRegisterMutate = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));

jest.mock("../../src/queries/authFlows", () => ({
  useRegister: () => ({ mutate: mockRegisterMutate, isPending: false, error: null }),
}));

function renderScreen() {
  return render(
    <KayaI18nProvider>
      <RegisterScreen />
    </KayaI18nProvider>,
  );
}

/** Walks the wizard to the vehicle step, filling what each step requires. */
function goToVehicleStep() {
  fireEvent.changeText(screen.getByTestId("register-phone"), "0201234567");
  fireEvent.press(screen.getByTestId("register-next"));
  fireEvent.changeText(screen.getByTestId("register-full-name"), "Kofi Boateng");
  fireEvent.changeText(screen.getByTestId("register-email"), "kofi@example.com");
  fireEvent.press(screen.getByTestId("register-next"));
}

beforeEach(() => {
  mockRegisterMutate.mockReset();
});

describe("driver sign-up, vehicle step", () => {
  it("labels each vehicle in the user's language, not with the wire value", () => {
    // The wire values are the Prisma enum's own -- `moto`, `voiture`,
    // `camionnette` -- and they were rendered directly as the button labels,
    // so an English-speaking driver in Accra chose their vehicle from a list
    // of French words.
    renderScreen();
    goToVehicleStep();

    expect(screen.getByTestId("register-vehicle-camionnette")).toHaveTextContent(
      resources.fr.translation.driverVehicleCamionnette,
    );
  });

  it("offers every vehicle the shared enum declares", () => {
    // The list used to be retyped in this screen. Read from @kaya/core, a
    // fourth vehicle added to the schema reaches the form on its own.
    renderScreen();
    goToVehicleStep();

    for (const type of VEHICLE_TYPES) {
      expect(screen.getByTestId(`register-vehicle-${type}`)).toBeTruthy();
    }
  });

  it("submits the wire value, not the translated label", () => {
    // The label is for the driver; the enum member is what the backend
    // validates against. Translating the value itself would 400.
    renderScreen();
    goToVehicleStep();

    fireEvent.press(screen.getByTestId("register-vehicle-voiture"));
    fireEvent.changeText(screen.getByTestId("register-licence"), "PCSRC-2024-001234");
    fireEvent.changeText(screen.getByTestId("register-qr-code"), "QR-1");
    fireEvent.press(screen.getByTestId("register-next"));

    fireEvent.changeText(screen.getByTestId("register-password"), "hunter2hunter2");
    fireEvent.changeText(screen.getByTestId("register-code"), "123456");
    fireEvent.press(screen.getByTestId("register-next"));

    expect(mockRegisterMutate).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleType: "voiture" }),
      expect.anything(),
    );
  });
});
