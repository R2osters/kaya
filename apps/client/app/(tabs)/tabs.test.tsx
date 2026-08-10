import { orderSchema, resources } from "@kaya/core";
import { KayaI18nProvider, resetMapProvider } from "@kaya/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { splitHistory } from "../../src/queries/orderList";
import HistoryScreen from "./history";
import HomeScreen from "./home";

const mockPush = jest.fn();
let mockOrders: { data?: unknown; isPending: boolean } = { data: undefined, isPending: false };

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../../src/queries/orderList", () => ({
  ...jest.requireActual("../../src/queries/orderList"),
  useMyOrders: () => mockOrders,
}));

function order(overrides: Record<string, unknown> = {}) {
  return orderSchema.parse({
    id: "order-1",
    clientId: "client-1",
    pickupAddress: "Osu, Accra",
    pickupLat: 5.5606,
    pickupLng: -0.1824,
    deliveryAddress: "Tema Station",
    deliveryLat: 5.6698,
    deliveryLng: -0.0166,
    status: "published",
    createdAt: "2026-08-10T10:00:00.000Z",
    ...overrides,
  });
}

function page(orders: ReturnType<typeof order>[]) {
  return { data: orders, page: 1, limit: 20, total: orders.length };
}

function renderScreen(Screen: () => React.ReactElement | null) {
  return render(
    <KayaI18nProvider>
      <Screen />
    </KayaI18nProvider>,
  );
}

beforeEach(() => {
  resetMapProvider();
  mockPush.mockReset();
  mockOrders = { data: page([order()]), isPending: false };
});

describe("splitHistory", () => {
  it("puts an undelivered scheduled order in upcoming", () => {
    const scheduled = order({ scheduledTime: "2026-09-01T10:00:00.000Z", status: "published" });

    expect(splitHistory([scheduled]).upcoming).toHaveLength(1);
  });

  it("puts a delivered scheduled order in the past, not in upcoming", () => {
    // isScheduled alone is not the split: something that already happened is
    // not something still to come.
    const done = order({ scheduledTime: "2026-07-01T10:00:00.000Z", status: "delivered" });

    expect(splitHistory([done]).upcoming).toHaveLength(0);
    expect(splitHistory([done]).past).toHaveLength(1);
  });

  it("puts a cancelled scheduled order in the past", () => {
    const cancelled = order({ scheduledTime: "2026-09-01T10:00:00.000Z", status: "cancelled" });

    expect(splitHistory([cancelled]).past).toHaveLength(1);
  });

  it("puts an immediate order in the past whatever its status", () => {
    expect(splitHistory([order({ status: "published" })]).past).toHaveLength(1);
  });

  it("orders the past most-recent-first", () => {
    const older = order({ id: "old", createdAt: "2026-08-01T10:00:00.000Z" });
    const newer = order({ id: "new", createdAt: "2026-08-09T10:00:00.000Z" });

    expect(splitHistory([older, newer]).past.map((o) => o.id)).toEqual(["new", "old"]);
  });

  it("orders upcoming soonest-first", () => {
    const later = order({ id: "later", scheduledTime: "2026-09-10T10:00:00.000Z" });
    const sooner = order({ id: "sooner", scheduledTime: "2026-09-01T10:00:00.000Z" });

    expect(splitHistory([later, sooner]).upcoming.map((o) => o.id)).toEqual(["sooner", "later"]);
  });
});

describe("HomeScreen", () => {
  it("offers the create-order action", () => {
    renderScreen(HomeScreen);

    fireEvent.press(screen.getByTestId("home-search"));

    expect(mockPush).toHaveBeenCalledWith("/create-order");
  });

  it("renders for a new user with no history at all", () => {
    // A new user has no history by definition, and the screen's point is the
    // action, not the map.
    mockOrders = { data: page([]), isPending: false };
    renderScreen(HomeScreen);

    expect(screen.getByTestId("home-search")).toBeTruthy();
    expect(screen.getByTestId("home-recent-empty")).toBeTruthy();
  });

  it("lists recent drop-offs", () => {
    renderScreen(HomeScreen);

    expect(screen.getByTestId("home-recent-0")).toBeTruthy();
  });

  it("shows at most three recent drop-offs", () => {
    mockOrders = {
      data: page([1, 2, 3, 4, 5].map((n) => order({ id: `o${n}` }))),
      isPending: false,
    };
    renderScreen(HomeScreen);

    expect(screen.getByTestId("home-recent-2")).toBeTruthy();
    expect(screen.queryByTestId("home-recent-3")).toBeNull();
  });

  it("has no scheduled shortcut, because scheduling is not built", () => {
    // A tile opening create-order with no date would be a lie about what the
    // app can do.
    renderScreen(HomeScreen);

    expect(screen.queryByTestId("home-scheduled")).toBeNull();
  });

  it("opens notifications", () => {
    renderScreen(HomeScreen);

    fireEvent.press(screen.getByTestId("home-notifications"));

    expect(mockPush).toHaveBeenCalledWith("/notifications");
  });
});

describe("HistoryScreen", () => {
  it("shows skeletons while loading", () => {
    mockOrders = { data: undefined, isPending: true };
    renderScreen(HistoryScreen);

    expect(screen.getByTestId("history-loading", { includeHiddenElements: true })).toBeTruthy();
  });

  it("starts on the past tab", () => {
    renderScreen(HistoryScreen);

    expect(screen.getByTestId("history-order-0")).toBeTruthy();
  });

  it("switches to scheduled and shows only what is still to come", () => {
    mockOrders = {
      data: page([
        order({ id: "immediate" }),
        order({ id: "scheduled", scheduledTime: "2026-09-01T10:00:00.000Z" }),
      ]),
      isPending: false,
    };
    renderScreen(HistoryScreen);

    fireEvent.press(screen.getByTestId("history-tab-upcoming"));

    expect(screen.getByTestId("history-order-0")).toBeTruthy();
    expect(screen.queryByTestId("history-order-1")).toBeNull();
  });

  it("shows an empty state per tab, not one for the whole screen", () => {
    mockOrders = { data: page([order()]), isPending: false };
    renderScreen(HistoryScreen);

    fireEvent.press(screen.getByTestId("history-tab-upcoming"));

    expect(screen.getByTestId("history-empty")).toHaveTextContent(
      new RegExp(resources.fr.translation.historyEmpty),
    );
  });

  it("opens an order's offers", () => {
    renderScreen(HistoryScreen);

    fireEvent.press(screen.getByTestId("history-order-0"));

    expect(mockPush).toHaveBeenCalledWith("/offers/order-1");
  });
});
