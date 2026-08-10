import { deliverySchema, resources } from "@kaya/core";
import { KayaI18nProvider, resetMapProvider } from "@kaya/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import TrackingScreen, { currentStep } from "./[deliveryId]";

let mockDelivery: { data?: unknown; isPending: boolean; error: unknown } = {
  data: undefined,
  isPending: false,
  error: null,
};
let mockLiveStatus: { status: string } | undefined;
let mockDriverLocation: { lat: number; lng: number } | undefined;
let mockLocationArg: string | null = null;

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ deliveryId: "delivery-1" }),
}));

jest.mock("../../src/queries/deliveries", () => ({
  useDelivery: () => mockDelivery,
  useDeliveryLiveStatus: () => mockLiveStatus,
  useDriverLocation: (livreurId: string | null) => {
    mockLocationArg = livreurId;
    return mockDriverLocation;
  },
}));

function delivery(overrides: Record<string, unknown> = {}) {
  return deliverySchema.parse({
    id: "delivery-1",
    orderId: "order-1",
    livreurId: "driver-7",
    status: "in_progress",
    clientPaymentStatus: "paid",
    createdAt: "2026-08-10T10:00:00.000Z",
    order: {
      id: "order-1",
      clientId: "client-1",
      pickupAddress: "Osu, Accra",
      pickupLat: 5.5606,
      pickupLng: -0.1824,
      deliveryAddress: "Tema Station",
      deliveryLat: 5.6698,
      deliveryLng: -0.0166,
      status: "in_progress",
      createdAt: "2026-08-10T10:00:00.000Z",
    },
    ...overrides,
  });
}

function renderScreen() {
  return render(
    <KayaI18nProvider>
      <TrackingScreen />
    </KayaI18nProvider>,
  );
}

beforeEach(() => {
  mockPush.mockReset();
  resetMapProvider();
  mockDelivery = { data: delivery(), isPending: false, error: null };
  mockLiveStatus = undefined;
  mockDriverLocation = undefined;
  mockLocationArg = null;
});

describe("currentStep", () => {
  it("falls back to the cached delivery with no live event yet", () => {
    expect(currentStep(delivery({ pickupTime: null }), undefined)).toBe(0);
  });

  it("prefers the live event, which arrives before the refetch", () => {
    // The whole reason the live status is held separately: the timeline should
    // advance when the driver acts, not once the invalidation has come back.
    expect(currentStep(delivery({ pickupTime: null }), "in_transit")).toBe(2);
  });

  it("ignores a live status that says nothing about position", () => {
    // A cancellation must not push the timeline forward.
    expect(currentStep(delivery({ pickupTime: null }), "cancelled")).toBe(0);
    expect(currentStep(delivery({ pickupTime: null }), "some_future_status")).toBe(0);
  });

  it("starts at step 0 before the delivery has loaded", () => {
    expect(currentStep(undefined, undefined)).toBe(0);
  });
});

describe("TrackingScreen", () => {
  it("shows a skeleton while the delivery loads", () => {
    mockDelivery = { data: undefined, isPending: true, error: null };
    renderScreen();

    expect(screen.getByTestId("tracking-map-loading", { includeHiddenElements: true })).toBeTruthy();
  });

  it("renders the map once the delivery is loaded", () => {
    renderScreen();

    expect(screen.getByTestId("tracking-map")).toBeTruthy();
  });

  it("asks for the position of this delivery's driver", () => {
    // location:driver is keyed by driver, not delivery -- its payload carries
    // no delivery id at all.
    renderScreen();

    expect(mockLocationArg).toBe("driver-7");
  });

  it("asks for no position while the delivery is unknown", () => {
    mockDelivery = { data: undefined, isPending: true, error: null };
    renderScreen();

    expect(mockLocationArg).toBeNull();
  });

  it("names the current step from the live status", () => {
    mockLiveStatus = { status: "in_transit" };
    renderScreen();

    expect(screen.getByTestId("tracking-step-label")).toHaveTextContent(
      resources.fr.translation.trackInTransit,
    );
  });

  it("marks every step up to the current one as done", () => {
    mockLiveStatus = { status: "picked_up" };
    renderScreen();

    expect(screen.getByTestId("tracking-step-0-done")).toBeTruthy();
    expect(screen.getByTestId("tracking-step-1-done")).toBeTruthy();
    expect(screen.queryByTestId("tracking-step-2-done")).toBeNull();
    expect(screen.getByTestId("tracking-step-2")).toBeTruthy();
  });

  it("renders a failure as a message", () => {
    mockDelivery = { data: undefined, isPending: false, error: new Error("404") };
    renderScreen();

    expect(screen.getByTestId("tracking-error")).toBeTruthy();
  });
  it("offers a way to reach the driver", () => {
    // Chat existed only behind the dev route explorer before this: the
    // journey dead-ended at tracking.
    renderScreen();

    fireEvent.press(screen.getByTestId("tracking-chat"));

    expect(mockPush).toHaveBeenCalledWith("/chat/delivery-1");
  });

  it("offers rating only once the delivery is done", () => {
    mockLiveStatus = { status: "in_transit" };
    renderScreen();
    expect(screen.queryByTestId("tracking-rate")).toBeNull();

    mockLiveStatus = { status: "delivered" };
    renderScreen();

    fireEvent.press(screen.getByTestId("tracking-rate"));
    expect(mockPush).toHaveBeenCalledWith("/rating/delivery-1");
  });
});
