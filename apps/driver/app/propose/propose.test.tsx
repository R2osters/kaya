import { KayaI18nProvider } from "@kaya/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import ProposeScreen from "./[orderId]";

const mockReplace = jest.fn();
const mockCreateMutate = jest.fn();

let mockOrder: { data?: unknown; isPending: boolean } = { data: undefined, isPending: false };
let mockConfig: { data?: unknown; isPending: boolean } = { data: undefined, isPending: false };
let mockStats: { data?: unknown } = { data: undefined };
let mockCreate: { isPending: boolean; error: unknown } = { isPending: false, error: null };

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ orderId: "o-1" }),
}));

jest.mock("../../src/queries/offers", () => ({
  useOrder: () => mockOrder,
  useCreateOffer: () => ({ mutate: mockCreateMutate, ...mockCreate }),
}));

jest.mock("../../src/queries/countryConfig", () => ({
  useCountryConfig: () => mockConfig,
}));

jest.mock("../../src/queries/driver", () => ({
  useDriverStats: () => mockStats,
}));

jest.mock("../../src/state/authStore", () => ({
  useAuthStore: (selector: (s: { user: unknown }) => unknown) =>
    selector({ user: { countryCode: "GHA", fullName: "Kofi" } }),
}));

/** Ghana's tariff card, as `GET /country-configs/GHA` returns it. */
const GHANA = {
  countryCode: "GHA",
  currency: "GHS",
  commissionTiers: [0.2, 0.15, 0.12, 0.09] as const,
  litigationFee: 1,
  withdrawalMethods: ["momo"],
  momoProviders: ["mtn"],
};

function renderScreen() {
  return render(
    <KayaI18nProvider>
      <ProposeScreen />
    </KayaI18nProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOrder = {
    data: {
      id: "o-1",
      pickupAddress: "Osu, Accra",
      deliveryAddress: "Tema Station",
      minPriceSuggested: 30,
    },
    isPending: false,
  };
  mockConfig = { data: GHANA, isPending: false };
  mockStats = { data: { dailyDeliveries: 0 } };
  mockCreate = { isPending: false, error: null };
});

describe("ProposePriceScreen", () => {
  it("opens at the order's minimum, which is the floor the backend enforces", () => {
    renderScreen();

    expect(screen.getByTestId("propose-price")).toHaveTextContent("30.00 GHS");
  });

  it("cannot be stepped below that floor", () => {
    // A bid under minPriceSuggested is rejected with a message about
    // decimals; the stepper simply never reaches one.
    renderScreen();

    fireEvent.press(screen.getByTestId("propose-decrease"));
    fireEvent.press(screen.getByTestId("propose-decrease"));

    expect(screen.getByTestId("propose-price")).toHaveTextContent("30.00 GHS");
  });

  it("steps up by the currency's own unit", () => {
    renderScreen();

    fireEvent.press(screen.getByTestId("propose-increase"));

    expect(screen.getByTestId("propose-price")).toHaveTextContent("31.00 GHS");
  });

  it("shows what the bid is worth after the country's commission and fee", () => {
    // 30 GHS at tier 1 (20 %) = 6 commission, 1 litigation fee, 23 net. Both
    // inputs come from the tariff card, never from constants.
    renderScreen();

    const breakdown = screen.getByTestId("propose-breakdown");
    expect(breakdown).toHaveTextContent(/6\.00 GHS/);
    expect(breakdown).toHaveTextContent(/23\.00 GHS/);
  });

  it("prices the run at the tier the driver's day has reached", () => {
    // Six done today means this is number seven: the rate steps to 15 %.
    mockStats = { data: { dailyDeliveries: 6 } };
    renderScreen();

    expect(screen.getByTestId("propose-tier")).toHaveTextContent(/15%/);
    expect(screen.getByTestId("propose-breakdown")).toHaveTextContent(/4\.50 GHS/);
  });

  it("submits the chosen price and leaves for home rather than back", () => {
    // Returning to the order invites a second tap, and a second bid can only
    // 409 -- one per driver per order.
    renderScreen();
    fireEvent.press(screen.getByTestId("propose-increase"));
    fireEvent.press(screen.getByTestId("propose-submit"));

    expect(mockCreateMutate).toHaveBeenCalledWith(31, expect.anything());

    const onSuccess = mockCreateMutate.mock.calls[0]?.[1] as { onSuccess: () => void };
    onSuccess.onSuccess();
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/home");
  });

  it("renders a rejected bid as a message rather than losing it", () => {
    mockCreate = { isPending: false, error: new Error("You must be online to submit an offer.") };
    renderScreen();

    expect(screen.getByTestId("propose-error")).toBeTruthy();
  });

  it("waits for the tariff card before showing any breakdown", () => {
    // Rendering a commission before the tiers arrive would mean showing a
    // guess about money, then correcting it.
    mockConfig = { data: undefined, isPending: true };
    renderScreen();

    // Skeletons are hidden from the accessibility tree on purpose (they say
    // nothing to a screen reader), so the query has to opt in to see them.
    expect(screen.getByTestId("propose-loading", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId("propose-breakdown")).toBeNull();
  });
});
