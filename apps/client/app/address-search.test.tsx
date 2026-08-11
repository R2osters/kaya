import { resources } from "@kaya/core";
import { KayaI18nProvider } from "@kaya/ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AddressSearchScreen from "./address-search";
import { useAddressSelectionStore } from "../src/state/addressSelectionStore";

const mockBack = jest.fn();
let mockSearch: { data?: unknown; isPending: boolean; error: unknown } = {
  data: undefined,
  isPending: false,
  error: null,
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockReverseMutateAsync = jest.fn();
jest.mock("../src/queries/geocoding", () => ({
  ...jest.requireActual("../src/queries/geocoding"),
  useAddressSearch: () => mockSearch,
  useReverseGeocode: () => ({ mutateAsync: mockReverseMutateAsync, isPending: false }),
}));

// "Use my position" needs a device; this suite is about the screen.
let mockLocation = {
  position: null as { lat: number; lng: number } | null,
  permission: "unknown" as "unknown" | "granted" | "denied",
  request: jest.fn(),
};
jest.mock("@kaya/ui", () => ({
  ...jest.requireActual("@kaya/ui"),
  useDeviceLocation: () => mockLocation,
}));

const OSU = {
  label: "Osu, Accra, Ghana",
  name: "Osu",
  city: "Accra",
  countryCode: "GH",
  lat: 5.5606,
  lng: -0.1824,
};

function renderScreen() {
  return render(
    <KayaI18nProvider>
      <AddressSearchScreen />
    </KayaI18nProvider>,
  );
}

function type(text: string) {
  fireEvent.changeText(screen.getByTestId("address-search-field-input"), text);
}

beforeEach(() => {
  mockBack.mockReset();
  mockSearch = { data: undefined, isPending: false, error: null };
  mockReverseMutateAsync.mockReset();
  mockLocation = { position: null, permission: "unknown", request: jest.fn() };
  useAddressSelectionStore.setState({ target: null, selection: null });
});

describe("AddressSearchScreen", () => {
  it("prompts instead of searching below the minimum length", () => {
    renderScreen();

    expect(screen.getByTestId("address-search-prompt")).toHaveTextContent(
      resources.fr.translation.addressSearchPrompt,
    );
    expect(screen.queryByTestId("address-search-results")).toBeNull();
  });

  it("shows skeletons while the first results load", () => {
    mockSearch = { data: undefined, isPending: true, error: null };
    renderScreen();
    type("Osu");

    expect(
      screen.getByTestId("address-search-loading", { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it("shows an empty state when nothing matches", () => {
    mockSearch = { data: [], isPending: false, error: null };
    renderScreen();
    type("Zzz");

    expect(screen.getByTestId("address-search-empty")).toBeTruthy();
  });

  it("lists the suggestions", () => {
    mockSearch = { data: [OSU], isPending: false, error: null };
    renderScreen();
    type("Osu");

    expect(screen.getByTestId("address-result-0")).toBeTruthy();
    expect(screen.getByText(OSU.label)).toBeTruthy();
  });

  it("renders a failure as a message, keeping any results readable", () => {
    // placeholderData keeps the previous list on screen; blanking it out
    // because a retyped query failed loses what the user could still use.
    mockSearch = { data: [OSU], isPending: false, error: new Error("network") };
    renderScreen();
    type("Osu");

    expect(screen.getByTestId("address-search-error")).toBeTruthy();
    expect(screen.getByTestId("address-result-0")).toBeTruthy();
  });

  it("records the chosen suggestion and goes back", () => {
    mockSearch = { data: [OSU], isPending: false, error: null };
    renderScreen();
    type("Osu");

    fireEvent.press(screen.getByTestId("address-result-0"));

    expect(useAddressSelectionStore.getState().selection).toEqual(OSU);
    expect(mockBack).toHaveBeenCalled();
  });

  it("goes back rather than pushing the opener, which would stack a second copy", () => {
    mockSearch = { data: [OSU], isPending: false, error: null };
    renderScreen();
    type("Osu");

    fireEvent.press(screen.getByTestId("address-result-0"));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("does not clear the selection itself -- the opener consumes it", () => {
    // The value has to survive the navigation back, and only the opener knows
    // when it has been applied.
    mockSearch = { data: [OSU], isPending: false, error: null };
    renderScreen();
    type("Osu");
    fireEvent.press(screen.getByTestId("address-result-0"));

    expect(useAddressSelectionStore.getState().selection).not.toBeNull();
  });
});

describe("addressSelectionStore", () => {
  it("clears any stale selection when a new search is opened", () => {
    // Otherwise the second field would immediately consume the first field's
    // address before the user picked anything.
    useAddressSelectionStore.getState().select(OSU);

    useAddressSelectionStore.getState().open("dropoff");

    expect(useAddressSelectionStore.getState().target).toBe("dropoff");
    expect(useAddressSelectionStore.getState().selection).toBeNull();
  });

  it("consume clears both the target and the selection", () => {
    useAddressSelectionStore.getState().open("pickup");
    useAddressSelectionStore.getState().select(OSU);

    useAddressSelectionStore.getState().consume();

    expect(useAddressSelectionStore.getState()).toMatchObject({ target: null, selection: null });
  });

  describe("use my position", () => {
    it("asks for permission, names the position, and selects it", async () => {
      const request = jest.fn().mockResolvedValue("granted");
      mockLocation = { position: { lat: 5.5606, lng: -0.1824 }, permission: "unknown", request };
      mockReverseMutateAsync.mockResolvedValue(OSU);
      render(<AddressSearchScreen />);

      fireEvent.press(screen.getByTestId("address-use-my-position"));

      await waitFor(() =>
        expect(useAddressSelectionStore.getState().selection?.label).toBe(OSU.label),
      );
      expect(request).toHaveBeenCalled();
      expect(mockBack).toHaveBeenCalled();
    });

    it("still selects the position when no address is known for it", async () => {
      // The coordinate is what the delivery is priced and routed from; the
      // label is context. Refusing to proceed would throw away a perfectly
      // good pickup point because nobody has mapped the street yet -- which in
      // peri-urban Accra is most of them.
      mockLocation = {
        position: { lat: 5.4, lng: -0.3 },
        permission: "granted",
        request: jest.fn(),
      };
      mockReverseMutateAsync.mockResolvedValue(null);
      render(<AddressSearchScreen />);

      fireEvent.press(screen.getByTestId("address-use-my-position"));

      await waitFor(() =>
        expect(useAddressSelectionStore.getState().selection?.lat).toBe(5.4),
      );
    });

    it("selects nothing when permission is refused, and says so", async () => {
      const request = jest.fn().mockResolvedValue("denied");
      mockLocation = { position: null, permission: "denied", request };
      render(<AddressSearchScreen />);

      fireEvent.press(screen.getByTestId("address-use-my-position"));

      await waitFor(() => expect(request).toHaveBeenCalled());
      expect(useAddressSelectionStore.getState().selection).toBeNull();
      expect(screen.getByTestId("address-location-denied")).toBeTruthy();
    });
  });
});