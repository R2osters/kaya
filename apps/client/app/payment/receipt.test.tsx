import { deliverySchema, resources } from "@kaya/core";
import { KayaI18nProvider } from "@kaya/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import ReceiptScreen from "./receipt";

const mockReplace = jest.fn();
let mockDelivery: { data?: unknown; isPending: boolean; error: unknown } = {
  data: undefined,
  isPending: false,
  error: null,
};
let mockCountry: string | undefined = "GHA";

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ deliveryId: "delivery-1" }),
}));

jest.mock("../../src/queries/deliveries", () => ({
  useDelivery: () => mockDelivery,
}));

jest.mock("../../src/state/authStore", () => ({
  useAuthStore: (selector: (state: { user: { countryCode?: string } | null }) => unknown) =>
    selector({ user: mockCountry === undefined ? null : { countryCode: mockCountry } }),
}));

function delivery(overrides: Record<string, unknown> = {}) {
  return deliverySchema.parse({
    id: "delivery-1",
    orderId: "3f2a91b8-1c4d-4e5f-9a7b-2c8d6e0f1a3b",
    livreurId: "driver-1",
    status: "in_progress",
    clientPaymentStatus: "paid",
    basePrice: "25.50",
    litigationFee: "1.00",
    createdAt: "2026-08-10T10:00:00.000Z",
    ...overrides,
  });
}

function renderScreen() {
  return render(
    <KayaI18nProvider>
      <ReceiptScreen />
    </KayaI18nProvider>,
  );
}

/** The currency suffix stripped, so a total can be compared as a number. */
function amountOf(testID: string): number {
  const text = screen.getByTestId(`${testID}-value`).props.children as string;
  return Number(text.replace(/[^\d.,-]/g, "").replace(/\s/g, "").replace(",", "."));
}

beforeEach(() => {
  mockReplace.mockReset();
  mockDelivery = { data: delivery(), isPending: false, error: null };
  mockCountry = "GHA";
});

describe("ReceiptScreen", () => {
  it("shows a skeleton while the delivery loads", () => {
    mockDelivery = { data: undefined, isPending: true, error: null };
    renderScreen();

    expect(screen.getByTestId("receipt-loading", { includeHiddenElements: true })).toBeTruthy();
  });

  it("breaks the payment into price, fee and total", () => {
    renderScreen();

    expect(screen.getByTestId("receipt-price-value")).toHaveTextContent("25.50 GHS");
    expect(screen.getByTestId("receipt-fee-value")).toHaveTextContent("1.00 GHS");
    expect(screen.getByTestId("receipt-total-value")).toHaveTextContent("26.50 GHS");
  });

  it("labels the price row as a price, not as a second total", () => {
    // The Dart original labels both rows `payTotal`, so the receipt reads
    // "Total ... Total". A receipt is the worst screen to mislabel.
    renderScreen();

    expect(screen.getByTestId("receipt-price")).toHaveTextContent(
      new RegExp(resources.fr.translation.payDeliveryPrice),
    );
    expect(screen.getByTestId("receipt-total")).toHaveTextContent(
      new RegExp(resources.fr.translation.payTotal),
    );
  });

  it("shows a total that is exactly the rows above it", () => {
    // What the user adds up has to be what they are shown.
    renderScreen();

    expect(amountOf("receipt-price") + amountOf("receipt-fee")).toBeCloseTo(
      amountOf("receipt-total"),
      2,
    );
  });

  it("sums exactly in XOF too, where there is no sub-unit", () => {
    mockCountry = "TGO";
    mockDelivery = {
      data: delivery({ basePrice: "900", litigationFee: "100" }),
      isPending: false,
      error: null,
    };
    renderScreen();

    // Intl groups fr-FR thousands with a narrow no-break space, so this
    // matches any whitespace rather than a literal one.
    expect(screen.getByTestId("receipt-total-value")).toHaveTextContent(/1\s*000 XOF/);
    expect(screen.getByTestId("receipt-total-value")).not.toHaveTextContent(/,00/);
  });

  it("treats a missing base price as zero rather than rendering NaN", () => {
    mockDelivery = { data: delivery({ basePrice: null }), isPending: false, error: null };
    renderScreen();

    expect(screen.getByTestId("receipt-price-value")).toHaveTextContent("0.00 GHS");
    expect(screen.getByTestId("receipt-total-value")).toHaveTextContent("1.00 GHS");
  });

  it("shortens the order id to something a human can read out", () => {
    renderScreen();

    // Built from the fixture rather than written out: an eight-character hex
    // string is indistinguishable from a colour, and the app's lint rule that
    // bans colour literals rightly flags one.
    const orderId = "3f2a91b8-1c4d-4e5f-9a7b-2c8d6e0f1a3b";
    expect(screen.getByTestId("receipt-order-value")).toHaveTextContent(
      `#${orderId.slice(0, 8).toUpperCase()}`,
    );
  });

  it("goes on to tracking", () => {
    renderScreen();

    fireEvent.press(screen.getByTestId("receipt-track"));

    expect(mockReplace).toHaveBeenCalledWith("/tracking/delivery-1");
  });

  it("renders a failure as a message", () => {
    mockDelivery = { data: undefined, isPending: false, error: new Error("404") };
    renderScreen();

    expect(screen.getByTestId("receipt-error")).toBeTruthy();
  });
});
