import { resources } from "@kaya/core";
import { KayaI18nProvider } from "@kaya/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import CreateOrderScreen from "./create-order";
import { useAddressSelectionStore } from "../src/state/addressSelectionStore";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockMutate = jest.fn();
let mockCreateState: { isPending: boolean; error: unknown } = { isPending: false, error: null };
let mockQuote: { data?: unknown; fetchStatus: string } = { data: undefined, fetchStatus: "idle" };

// useFocusEffect runs its callback immediately here: the real one fires on
// focus, and every render in this suite *is* the screen coming into focus.
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useFocusEffect: (cb: () => void) => cb(),
}));

jest.mock("../src/queries/orders", () => ({
  useCreateOrder: () => ({ mutate: mockMutate, ...mockCreateState }),
}));

jest.mock("../src/queries/pricing", () => ({
  usePriceQuote: () => mockQuote,
}));

const OSU = {
  label: "Osu, Accra, Ghana",
  name: "Osu",
  city: "Accra",
  countryCode: "GH",
  lat: 5.5606,
  lng: -0.1824,
};
const TEMA = { ...OSU, label: "Tema Station, Tema, Ghana", name: "Tema Station", lat: 5.6698, lng: -0.0166 };

function renderScreen() {
  return render(
    <KayaI18nProvider>
      <CreateOrderScreen />
    </KayaI18nProvider>,
  );
}

/** Simulates coming back from /address-search with a chosen address. */
function returnFromSearch(target: "pickup" | "dropoff", suggestion: typeof OSU) {
  useAddressSelectionStore.setState({ target, selection: suggestion });
}

beforeEach(() => {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockMutate.mockReset();
  mockCreateState = { isPending: false, error: null };
  mockQuote = { data: undefined, fetchStatus: "idle" };
  useAddressSelectionStore.setState({ target: null, selection: null });
});

describe("CreateOrderScreen", () => {
  it("starts with both addresses empty", () => {
    renderScreen();

    expect(screen.getByTestId("create-order-pickup-value")).toHaveTextContent("—");
    expect(screen.getByTestId("create-order-dropoff-value")).toHaveTextContent("—");
  });

  it("opens the search for the field that was tapped", () => {
    renderScreen();

    fireEvent.press(screen.getByTestId("create-order-dropoff"));

    expect(useAddressSelectionStore.getState().target).toBe("dropoff");
    expect(mockPush).toHaveBeenCalledWith("/address-search");
  });

  it("fills the field the search was opened for, and consumes the selection", () => {
    returnFromSearch("pickup", OSU);
    renderScreen();

    expect(screen.getByTestId("create-order-pickup-value")).toHaveTextContent(OSU.label);
    // Left unconsumed, the other field would swallow this address next time
    // the screen focused.
    expect(useAddressSelectionStore.getState().selection).toBeNull();
  });

  it("does not put a pickup result into the dropoff field", () => {
    returnFromSearch("dropoff", TEMA);
    renderScreen();

    expect(screen.getByTestId("create-order-dropoff-value")).toHaveTextContent(TEMA.label);
    expect(screen.getByTestId("create-order-pickup-value")).toHaveTextContent("—");
  });

  it("prompts for both addresses before a quote can exist", () => {
    renderScreen();

    expect(screen.getByTestId("create-order-quote-pending")).toHaveTextContent(
      resources.fr.translation.orderQuotePending,
    );
  });

  it("renders a quote in the country's own currency unit", () => {
    // XOF has no sub-unit: 1 250,50 F is a price no CFA-zone gateway can take.
    mockQuote = {
      fetchStatus: "idle",
      data: { minPrice: 941, currency: "XOF", distanceKm: 4.27 },
    };
    renderScreen();

    expect(screen.getByTestId("create-order-quote-amount")).toHaveTextContent("941 XOF");
  });

  it("renders pesewas for a Ghanaian quote", () => {
    mockQuote = {
      fetchStatus: "idle",
      data: { minPrice: 12.5, currency: "GHS", distanceKm: 10 },
    };
    renderScreen();

    expect(screen.getByTestId("create-order-quote-amount")).toHaveTextContent("12.50 GHS");
  });

  it("refuses to submit without both addresses, and calls nothing", () => {
    renderScreen();

    fireEvent.press(screen.getByTestId("create-order-submit"));

    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId("create-order-error")).toHaveTextContent(
      resources.fr.translation.orderAddressMissing,
    );
  });

  it("submits both addresses, the description and the size", () => {
    returnFromSearch("pickup", OSU);
    const { rerender } = renderScreen();
    returnFromSearch("dropoff", TEMA);
    rerender(
      <KayaI18nProvider>
        <CreateOrderScreen />
      </KayaI18nProvider>,
    );

    fireEvent.changeText(screen.getByTestId("create-order-description-input"), "shoe box");
    fireEvent.press(screen.getByTestId("create-order-size-L"));
    fireEvent.press(screen.getByTestId("create-order-submit"));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ description: "shoe box", size: "L" }),
      expect.anything(),
    );
  });

  it("defaults the size to M, matching the Dart original", () => {
    returnFromSearch("pickup", OSU);
    const { rerender } = renderScreen();
    returnFromSearch("dropoff", TEMA);
    rerender(
      <KayaI18nProvider>
        <CreateOrderScreen />
      </KayaI18nProvider>,
    );

    fireEvent.press(screen.getByTestId("create-order-submit"));

    expect(mockMutate.mock.calls[0]?.[0]).toMatchObject({ size: "M" });
  });

  it("routes to the offers screen only once the order is published", () => {
    returnFromSearch("pickup", OSU);
    const { rerender } = renderScreen();
    returnFromSearch("dropoff", TEMA);
    rerender(
      <KayaI18nProvider>
        <CreateOrderScreen />
      </KayaI18nProvider>,
    );
    fireEvent.press(screen.getByTestId("create-order-submit"));

    // Nothing has navigated yet -- the mutation has not resolved.
    expect(mockReplace).not.toHaveBeenCalled();

    const options = mockMutate.mock.calls[0]?.[1] as { onSuccess: (o: unknown) => void };
    options.onSuccess({ id: "order-1" });

    expect(mockReplace).toHaveBeenCalledWith("/offers/order-1");
  });

  it("renders a server failure as a message", () => {
    mockCreateState = { isPending: false, error: new Error("Publication failed.") };
    renderScreen();

    expect(screen.getByTestId("create-order-error")).toBeTruthy();
  });

  it("has no photo control -- the backend has nowhere to put one", () => {
    // The Dart screen collects a photo and never sends it; see this screen's
    // doc comment.
    renderScreen();

    expect(screen.queryByTestId("create-order-photo")).toBeNull();
  });

  it("has no schedule control in this slice", () => {
    renderScreen();

    expect(screen.queryByTestId("create-order-schedule")).toBeNull();
  });
});
