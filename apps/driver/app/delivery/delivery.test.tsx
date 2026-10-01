import { resources } from "@kaya/core";
import { KayaI18nProvider } from "@kaya/ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ActiveDeliveryScreen from "./[deliveryId]";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockStart = jest.fn();
const mockPickup = jest.fn();
const mockTransit = jest.fn();
const mockConfirm = jest.fn();
const mockCapture = jest.fn();

let mockDelivery: { data?: unknown; isPending: boolean } = { data: undefined, isPending: false };
let mockLiveStatus: { status: string } | undefined;
let mockUploading = false;

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ deliveryId: "d-1" }),
}));

jest.mock("../../src/queries/deliveries", () => ({
  useDelivery: () => mockDelivery,
  useDeliveryLiveStatus: () => mockLiveStatus,
  useStartDelivery: () => ({ mutate: mockStart, isPending: false, error: null }),
  usePickupDelivery: () => ({ mutate: mockPickup, isPending: false, error: null }),
  useTransitDelivery: () => ({ mutate: mockTransit, isPending: false, error: null }),
  useConfirmDelivery: () => ({ mutate: mockConfirm, isPending: false, error: null }),
}));

jest.mock("../../src/delivery/useDeliveryPhoto", () => ({
  useDeliveryPhoto: () => ({ capture: mockCapture, uploading: mockUploading }),
}));

jest.mock("@kaya/ui", () => {
  const actual = jest.requireActual("@kaya/ui");
  const { View } = jest.requireActual("react-native");
  // The map needs a registered native provider; this suite is about the
  // action bar, not about tiles.
  return { ...actual, MapView: (props: { testID?: string }) => <View testID={props.testID} /> };
});

/**
 * Advances the run.
 *
 * The control is a slide, not a button: a driver's phone spends its day in a
 * pocket, and an accidental "delivered" releases an escrow on a package still
 * strapped to the bike. A drag cannot be expressed as a Jest event, so these
 * tests go through the same accessibility activate action a screen reader
 * would use — the control's other deliberate entry point, not a test hatch.
 */
function advance() {
  fireEvent(screen.getByTestId("delivery-action"), "accessibilityAction", {
    nativeEvent: { actionName: "activate" },
  });
}

function deliveryWith(status: string) {
  return {
    data: {
      id: "d-1",
      status: "in_progress",
      order: {
        status,
        pickupAddress: "Osu, Accra",
        deliveryAddress: "Tema Station",
        pickup: { lat: 5.56, lng: -0.18 },
        dropoff: { lat: 5.67, lng: -0.02 },
      },
    },
    isPending: false,
  };
}

function renderScreen() {
  return render(
    <KayaI18nProvider>
      <ActiveDeliveryScreen />
    </KayaI18nProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDelivery = deliveryWith("accepted");
  mockLiveStatus = undefined;
  mockUploading = false;
  mockCapture.mockResolvedValue("delivery-photos/abc.jpg");
});

describe("ActiveDeliveryScreen", () => {
  it("offers the start of the run on a freshly accepted order", () => {
    renderScreen();

    advance();

    expect(mockStart).toHaveBeenCalled();
  });

  it("asks for the pickup photo, then posts the pickup with its storage key", async () => {
    mockDelivery = deliveryWith("driver_en_route");
    renderScreen();

    advance();

    await waitFor(() => expect(mockPickup).toHaveBeenCalledWith("delivery-photos/abc.jpg"));
  });

  it("still posts the pickup when the photo could not be taken", async () => {
    // A refused camera or a failed upload must not strand a driver holding a
    // package at a doorstep; the backend takes the photo as optional.
    mockCapture.mockResolvedValue(null);
    mockDelivery = deliveryWith("driver_en_route");
    renderScreen();

    advance();

    await waitFor(() => expect(mockPickup).toHaveBeenCalledWith(undefined));
    expect(screen.getByTestId("delivery-photo-skipped")).toBeTruthy();
  });

  it("moves to transit once the package is picked up", () => {
    mockDelivery = deliveryWith("picked_up");
    renderScreen();

    advance();

    expect(mockTransit).toHaveBeenCalled();
  });

  it("confirms delivery from in transit and goes on to rate the client", () => {
    mockDelivery = deliveryWith("in_transit");
    renderScreen();

    advance();

    expect(mockConfirm).toHaveBeenCalledWith(undefined, expect.anything());
    const options = mockConfirm.mock.calls[0]?.[1] as { onSuccess: () => void };
    options.onSuccess();
    // replace, not push: back must not return to a finished run whose only
    // button posts a transition the backend refuses.
    expect(mockReplace).toHaveBeenCalledWith("/rating/d-1");
  });

  it("prefers the live status over the fetched delivery", () => {
    // The transition lands on the socket before the refetch returns; the bar
    // has to advance then, not one round trip later.
    mockDelivery = deliveryWith("accepted");
    mockLiveStatus = { status: "in_transit" };
    renderScreen();

    advance();

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("offers nothing once the run is over", () => {
    mockDelivery = deliveryWith("delivered");
    renderScreen();

    advance();

    expect(mockStart).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("labels the step the driver is on", () => {
    mockDelivery = deliveryWith("picked_up");
    renderScreen();

    expect(screen.getByTestId("delivery-step-label")).toHaveTextContent(
      resources.fr.translation.trackInTransit,
    );
  });

  it("opens the thread with the client", () => {
    renderScreen();

    fireEvent.press(screen.getByTestId("delivery-chat"));

    expect(mockPush).toHaveBeenCalledWith("/chat/d-1");
  });
});
