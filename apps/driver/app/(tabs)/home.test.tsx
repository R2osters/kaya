import { KayaI18nProvider } from "@kaya/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import DriverHomeScreen from "./home";

const mockPush = jest.fn();
const mockSetOnline = jest.fn();
const mockRequestLocation = jest.fn();

let mockUser: Record<string, unknown> | null = null;
let mockLocation = {
  position: { lat: 5.56, lng: -0.18 } as { lat: number; lng: number } | null,
  permission: "granted" as "unknown" | "granted" | "denied",
  request: mockRequestLocation,
};
let mockNearby: { data?: unknown; isPending: boolean } = { data: [], isPending: false };
let mockStats: { data?: unknown } = { data: undefined };
let mockActive: unknown;
let mockSetOnlineState = { isPending: false };
let lastPublishing: boolean | undefined;

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock("../../src/location/useDriverLocation", () => ({
  useDriverLocation: (publishing: boolean) => {
    lastPublishing = publishing;
    return mockLocation;
  },
}));

jest.mock("../../src/queries/nearby", () => ({
  useNearbyOrders: () => mockNearby,
}));

jest.mock("../../src/queries/driver", () => ({
  useDriverStats: () => mockStats,
  useSetOnline: () => ({ mutate: mockSetOnline, ...mockSetOnlineState }),
}));

jest.mock("../../src/queries/deliveries", () => ({
  useActiveDelivery: () => mockActive,
}));

jest.mock("../../src/state/authStore", () => ({
  useAuthStore: (selector: (s: { user: unknown }) => unknown) => selector({ user: mockUser }),
}));

jest.mock("@kaya/ui", () => {
  const actual = jest.requireActual("@kaya/ui");
  const { View } = jest.requireActual("react-native");
  return { ...actual, MapView: (props: { testID?: string }) => <View testID={props.testID} /> };
});

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "o-1",
    pickupAddress: "Osu, Accra",
    deliveryAddress: "Tema Station",
    pickup: { lat: 5.56, lng: -0.18 },
    dropoff: { lat: 5.67, lng: -0.02 },
    distanceToPickupKm: 2.4,
    minPriceSuggested: 30,
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <KayaI18nProvider>
      <DriverHomeScreen />
    </KayaI18nProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { countryCode: "GHA", isOnline: true, fullName: "Kofi Boateng" };
  mockLocation = {
    position: { lat: 5.56, lng: -0.18 },
    permission: "granted",
    request: mockRequestLocation,
  };
  mockNearby = { data: [], isPending: false };
  mockStats = { data: { todayEarnings: 84.5, currency: "GHS", dailyDeliveries: 3 } };
  mockActive = undefined;
  mockSetOnlineState = { isPending: false };
  lastPublishing = undefined;
});

describe("DriverHomeScreen", () => {
  it("goes online through the endpoint, which is what makes bidding possible at all", () => {
    // Offline, OffersService refuses every bid: the toggle is a precondition,
    // not a preference.
    mockUser = { countryCode: "GHA", isOnline: false, fullName: "Kofi" };
    renderScreen();

    fireEvent(screen.getByTestId("home-online-toggle"), "valueChange", true);

    expect(mockSetOnline).toHaveBeenCalledWith(true);
  });

  it("asks for location on the way online, not at launch", () => {
    // A permission prompt on first open, before the app has shown what it
    // needs it for, is the one most often refused outright.
    mockUser = { countryCode: "GHA", isOnline: false, fullName: "Kofi" };
    mockLocation = { position: null, permission: "unknown", request: mockRequestLocation };
    renderScreen();

    fireEvent(screen.getByTestId("home-online-toggle"), "valueChange", true);

    expect(mockRequestLocation).toHaveBeenCalled();
  });

  it("publishes position only while online", () => {
    renderScreen();
    expect(lastPublishing).toBe(true);

    screen.unmount();
    mockUser = { countryCode: "GHA", isOnline: false, fullName: "Kofi" };
    renderScreen();
    expect(lastPublishing).toBe(false);
  });

  it("says what to do rather than showing an empty list while offline", () => {
    mockUser = { countryCode: "GHA", isOnline: false, fullName: "Kofi" };
    renderScreen();

    expect(screen.getByTestId("home-nearby-offline")).toBeTruthy();
  });

  it("lists nearby work with its distance and floor price", () => {
    mockNearby = { data: [order()], isPending: false };
    renderScreen();

    const row = screen.getByTestId("home-request-0");
    expect(row).toHaveTextContent(/Tema Station/);
    expect(row).toHaveTextContent(/2\.4 km/);
    expect(row).toHaveTextContent(/30\.00 GHS/);
  });

  it("opens the bid screen for the order tapped", () => {
    mockNearby = { data: [order()], isPending: false };
    renderScreen();

    fireEvent.press(screen.getByTestId("home-request-0"));

    expect(mockPush).toHaveBeenCalledWith("/propose/o-1");
  });

  it("shows today's earnings, which is the tier the next run is priced at", () => {
    renderScreen();

    expect(screen.getByTestId("home-today-amount")).toHaveTextContent("84.50 GHS");
  });

  it("surfaces a run already in progress above the list of new work", () => {
    mockActive = { id: "d-1", order: { deliveryAddress: "Tema Station" } };
    renderScreen();

    fireEvent.press(screen.getByTestId("home-active-delivery"));

    expect(mockPush).toHaveBeenCalledWith("/delivery/d-1");
  });

  it("offers a way back when location was refused", () => {
    // A refusal is a state to recover from, not a failure to go online: a
    // driver without GPS can still legitimately want to be marked available.
    mockLocation = { position: null, permission: "denied", request: mockRequestLocation };
    renderScreen();

    expect(screen.getByTestId("home-location-denied")).toBeTruthy();
    fireEvent.press(screen.getByTestId("home-location-request"));
    expect(mockRequestLocation).toHaveBeenCalled();
  });
});
