import { resources } from "@kaya/core";
import { KayaI18nProvider } from "@kaya/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import OffersScreen from "./[orderId]";

const mockReplace = jest.fn();
const mockAcceptMutate = jest.fn();
let mockOffers: { data?: unknown; isPending: boolean } = { data: undefined, isPending: false };
let mockAccept: { isPending: boolean; error: unknown } = { isPending: false, error: null };
let mockCountry: string | undefined = "GHA";

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ orderId: "order-1" }),
}));

jest.mock("../../src/queries/offers", () => ({
  useOffers: () => mockOffers,
  useAcceptOffer: () => ({ mutate: mockAcceptMutate, ...mockAccept }),
}));

jest.mock("../../src/state/authStore", () => ({
  useAuthStore: (selector: (state: { user: { countryCode?: string } | null }) => unknown) =>
    selector({ user: mockCountry === undefined ? null : { countryCode: mockCountry } }),
}));

function offer(overrides: Record<string, unknown> = {}) {
  return {
    id: "offer-1",
    livreurId: "driver-1",
    livreurName: "Kofi B.",
    livreurPhoto: null,
    livreurRating: 4.5,
    livreurTotalDeliveries: 318,
    proposedPrice: 30,
    status: "pending",
    createdAt: new Date(),
    expiresAt: null,
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <KayaI18nProvider>
      <OffersScreen />
    </KayaI18nProvider>,
  );
}

beforeEach(() => {
  mockReplace.mockReset();
  mockAcceptMutate.mockReset();
  mockOffers = { data: undefined, isPending: false };
  mockAccept = { isPending: false, error: null };
  mockCountry = "GHA";
});

describe("OffersScreen", () => {
  it("shows skeletons while the first load runs", () => {
    mockOffers = { data: undefined, isPending: true };
    renderScreen();

    expect(screen.getByTestId("offers-loading", { includeHiddenElements: true })).toBeTruthy();
  });

  it("shows an empty state while no driver has bid", () => {
    mockOffers = { data: { orderId: "order-1", minPrice: 25, offers: [] }, isPending: false };
    renderScreen();

    // EmptyState renders a title and a message in one node, so this matches a
    // substring rather than the whole content.
    expect(screen.getByTestId("offers-empty")).toHaveTextContent(
      new RegExp(resources.fr.translation.offersEmptyTitle),
    );
  });

  it("lists a bid with its driver and price", () => {
    mockOffers = { data: { orderId: "order-1", minPrice: 25, offers: [offer()] }, isPending: false };
    renderScreen();

    expect(screen.getByTestId("offer-0")).toBeTruthy();
    expect(screen.getByText("Kofi B.")).toBeTruthy();
    expect(screen.getByTestId("offer-0-price")).toHaveTextContent("30.00 GHS");
  });

  it("prices in the client's own currency, not a hardcoded one", () => {
    // country_configs is keyed by country and Order carries neither a currency
    // nor a country; the signed-in user is the only place that knows.
    mockCountry = "TGO";
    mockOffers = {
      data: { orderId: "order-1", minPrice: 2500, offers: [offer({ proposedPrice: 3000 })] },
      isPending: false,
    };
    renderScreen();

    expect(screen.getByTestId("offer-0-price")).toHaveTextContent(/XOF/);
    // XOF has no sub-unit.
    expect(screen.getByTestId("offer-0-price")).not.toHaveTextContent(/,00/);
  });

  it("falls back to GHS when the user is not loaded yet", () => {
    mockCountry = undefined;
    mockOffers = { data: { orderId: "order-1", minPrice: 25, offers: [offer()] }, isPending: false };
    renderScreen();

    expect(screen.getByTestId("offer-0-price")).toHaveTextContent(/GHS/);
  });

  it("shows the platform's suggested minimum", () => {
    mockOffers = { data: { orderId: "order-1", minPrice: 25, offers: [offer()] }, isPending: false };
    renderScreen();

    expect(screen.getByTestId("offers-min-price")).toHaveTextContent(/25\.00 GHS/);
  });

  it("accepts the bid that was tapped", () => {
    mockOffers = {
      data: {
        orderId: "order-1",
        minPrice: 25,
        offers: [offer(), offer({ id: "offer-2", proposedPrice: 28 })],
      },
      isPending: false,
    };
    renderScreen();

    fireEvent.press(screen.getByTestId("offer-1-accept"));

    expect(mockAcceptMutate).toHaveBeenCalledWith("offer-2", expect.anything());
  });

  it("routes to payment only once the delivery exists", () => {
    mockOffers = { data: { orderId: "order-1", minPrice: 25, offers: [offer()] }, isPending: false };
    renderScreen();
    fireEvent.press(screen.getByTestId("offer-0-accept"));

    expect(mockReplace).not.toHaveBeenCalled();

    const options = mockAcceptMutate.mock.calls[0]?.[1] as {
      onSuccess: (d: { id: string }) => void;
    };
    options.onSuccess({ id: "delivery-1" });

    // To payment, not tracking: the delivery is in escrow until it is paid
    // for, and sending a client to watch a driver they have not paid skips the
    // step the whole model rests on.
    expect(mockReplace).toHaveBeenCalledWith(
      "/payment?deliveryId=delivery-1&amount=30&currency=GHS",
    );
  });

  it("stops every Accept button while one acceptance is in flight", () => {
    // Two accepted offers is two deliveries for one order.
    mockAccept = { isPending: true, error: null };
    mockOffers = {
      data: {
        orderId: "order-1",
        minPrice: 25,
        offers: [offer(), offer({ id: "offer-2" })],
      },
      isPending: false,
    };
    renderScreen();

    fireEvent.press(screen.getByTestId("offer-1-accept"));

    expect(mockAcceptMutate).not.toHaveBeenCalled();
  });

  it("renders a failed acceptance as a message", () => {
    mockAccept = { isPending: false, error: new Error("Offer already accepted.") };
    mockOffers = { data: { orderId: "order-1", minPrice: 25, offers: [offer()] }, isPending: false };
    renderScreen();

    expect(screen.getByTestId("offers-error")).toBeTruthy();
  });
});
