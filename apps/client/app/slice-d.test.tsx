import { appNotificationSchema, deliverySchema, resources, userSchema } from "@kaya/core";
import { KayaI18nProvider } from "@kaya/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import InboxScreen from "./(tabs)/inbox";
import ProfileScreen from "./(tabs)/profile";
import NotificationsScreen from "./notifications";

const mockPush = jest.fn();
const mockMarkRead = jest.fn();
const mockSignOut = jest.fn();
const mockSetLocale = jest.fn();
let mockDeliveries: { data?: unknown; isPending: boolean } = { data: [], isPending: false };
let mockNotifications: { data?: unknown; isPending: boolean } = { data: undefined, isPending: false };
let mockUser: unknown = null;

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../src/queries/inbox", () => ({
  useMyDeliveries: () => mockDeliveries,
  useNotifications: () => mockNotifications,
  useMarkNotificationRead: () => ({ mutate: mockMarkRead }),
}));

jest.mock("../src/state/authStore", () => ({
  useAuthStore: (selector: (state: { user: unknown; signOut: unknown }) => unknown) =>
    selector({ user: mockUser, signOut: mockSignOut }),
}));

jest.mock("../src/state/localeStore", () => ({
  useLocaleStore: (selector: (state: { setLocale: unknown }) => unknown) =>
    selector({ setLocale: mockSetLocale }),
}));

function delivery(overrides: Record<string, unknown> = {}) {
  return deliverySchema.parse({
    id: "d-1",
    orderId: "order-1",
    livreurId: "driver-1",
    status: "in_progress",
    clientPaymentStatus: "paid",
    createdAt: "2026-08-10T10:00:00.000Z",
    livreur: {
      id: "driver-1",
      fullName: "Kofi Boateng",
      role: "livreur",
      countryCode: "GHA",
    },
    order: {
      id: "order-1",
      clientId: "c-1",
      pickupAddress: "Osu, Accra",
      pickupLat: 5.56,
      pickupLng: -0.18,
      deliveryAddress: "Tema Station",
      deliveryLat: 5.67,
      deliveryLng: -0.02,
      status: "in_progress",
      createdAt: "2026-08-10T10:00:00.000Z",
    },
    ...overrides,
  });
}

function notification(overrides: Record<string, unknown> = {}) {
  return appNotificationSchema.parse({
    id: "n-1",
    type: "new_offer",
    title: "Nouvelle offre",
    body: "Kofi propose 30 GHS",
    data: {},
    readAt: null,
    createdAt: "2026-08-10T10:00:00.000Z",
    ...overrides,
  });
}

function user(overrides: Record<string, unknown> = {}) {
  return userSchema.parse({
    id: "u-1",
    fullName: "Ama Owusu",
    phone: "+233201111111",
    role: "client",
    countryCode: "GHA",
    isVerified: true,
    ratingClient: 4.5,
    totalDeliveries: 12,
    balance: "150.00",
    ...overrides,
  });
}

function renderScreen(Screen: () => React.ReactElement | null) {
  return render(
    <KayaI18nProvider>
      <Screen />
    </KayaI18nProvider>,
  );
}

beforeEach(() => {
  mockPush.mockReset();
  mockMarkRead.mockReset();
  mockSignOut.mockReset();
  mockSetLocale.mockReset();
  mockDeliveries = { data: [], isPending: false };
  mockNotifications = { data: undefined, isPending: false };
  mockUser = user();
});

describe("InboxScreen", () => {
  it("shows the empty state with no conversations", () => {
    renderScreen(InboxScreen);

    expect(screen.getByTestId("inbox-empty")).toHaveTextContent(
      new RegExp(resources.fr.translation.inboxEmpty),
    );
  });

  it("lists one conversation per delivery, named after the driver", () => {
    mockDeliveries = { data: [delivery()], isPending: false };
    renderScreen(InboxScreen);

    expect(screen.getByTestId("inbox-thread-0")).toHaveTextContent(/Kofi Boateng/);
  });

  it("opens that delivery's chat", () => {
    mockDeliveries = { data: [delivery()], isPending: false };
    renderScreen(InboxScreen);

    fireEvent.press(screen.getByTestId("inbox-thread-0"));

    expect(mockPush).toHaveBeenCalledWith("/chat/d-1");
  });
});

describe("NotificationsScreen", () => {
  it("shows the empty state when caught up", () => {
    mockNotifications = { data: { data: [], page: 1, limit: 20, total: 0, unread: 0 }, isPending: false };
    renderScreen(NotificationsScreen);

    expect(screen.getByTestId("notifications-empty")).toHaveTextContent(
      new RegExp(resources.fr.translation.notifEmpty),
    );
  });

  it("marks an unread row read on tap", () => {
    mockNotifications = {
      data: { data: [notification()], page: 1, limit: 20, total: 1, unread: 1 },
      isPending: false,
    };
    renderScreen(NotificationsScreen);

    expect(screen.getByTestId("notification-0-dot")).toBeTruthy();
    fireEvent.press(screen.getByTestId("notification-0-unread"));

    expect(mockMarkRead).toHaveBeenCalledWith("n-1");
  });

  it("does not re-mark an already-read row", () => {
    mockNotifications = {
      data: {
        data: [notification({ readAt: "2026-08-10T11:00:00.000Z" })],
        page: 1,
        limit: 20,
        total: 1,
        unread: 0,
      },
      isPending: false,
    };
    renderScreen(NotificationsScreen);

    expect(screen.queryByTestId("notification-0-dot")).toBeNull();
    fireEvent.press(screen.getByTestId("notification-0"));

    expect(mockMarkRead).not.toHaveBeenCalled();
  });
});

describe("ProfileScreen", () => {
  it("shows the identity the session already holds -- no fetch, no skeleton", () => {
    renderScreen(ProfileScreen);

    expect(screen.getByTestId("profile-name")).toHaveTextContent("Ama Owusu");
    expect(screen.getByTestId("profile-verified")).toBeTruthy();
  });

  it("shows the balance in the user's own currency", () => {
    renderScreen(ProfileScreen);

    expect(screen.getByTestId("profile-balance")).toHaveTextContent("150.00 GHS");
  });

  it("shows XOF for a Togolese user", () => {
    mockUser = user({ countryCode: "TGO", balance: "2500" });
    renderScreen(ProfileScreen);

    expect(screen.getByTestId("profile-balance")).toHaveTextContent(/XOF/);
  });

  it("switches the language through the persisted store", () => {
    renderScreen(ProfileScreen);

    fireEvent.press(screen.getByTestId("profile-lang-en"));

    expect(mockSetLocale).toHaveBeenCalledWith("en");
  });

  it("signs out through the store -- the guard does the navigation", () => {
    renderScreen(ProfileScreen);

    fireEvent.press(screen.getByTestId("profile-logout"));

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("has no addresses or payment-methods doors -- those resources do not exist", () => {
    renderScreen(ProfileScreen);

    expect(screen.queryByTestId("profile-addresses")).toBeNull();
    expect(screen.queryByTestId("profile-payment-methods")).toBeNull();
  });
});
