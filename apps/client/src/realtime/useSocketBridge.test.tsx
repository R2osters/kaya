import { queryKeys } from "@kaya/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { toRealtimeCache, useSocketBridge } from "./useSocketBridge";

let mockStatus: "unknown" | "authenticated" | "anonymous" = "authenticated";
let mockSkipAuth = false;
let mockToken: string | null = "access-token";

const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockOn = jest.fn();
const mockUnsubscribe = jest.fn();
const mockReadAccess = jest.fn();

jest.mock("./socket", () => ({
  socketService: {
    connect: (...args: unknown[]) => mockConnect(...args),
    disconnect: () => mockDisconnect(),
    on: (...args: unknown[]) => {
      mockOn(...args);
      return mockUnsubscribe;
    },
  },
}));

jest.mock("../state/authStore", () => ({
  useAuthStore: (selector: (state: { status: string }) => unknown) =>
    selector({ status: mockStatus }),
}));

jest.mock("../config/env", () => ({
  get env() {
    return { skipAuth: mockSkipAuth };
  },
}));

jest.mock("@kaya/ui", () => ({
  SecureTokenStore: class {
    readAccess() {
      return mockReadAccess();
    }
  },
}));

function Probe() {
  useSocketBridge();
  return null;
}

function renderBridge(queryClient = new QueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<Probe />, { wrapper });
}

beforeEach(() => {
  mockStatus = "authenticated";
  mockSkipAuth = false;
  mockToken = "access-token";
  mockConnect.mockClear();
  mockDisconnect.mockClear();
  mockOn.mockClear();
  mockUnsubscribe.mockClear();
  mockReadAccess.mockReset();
  mockReadAccess.mockImplementation(() => Promise.resolve(mockToken));
});

describe("useSocketBridge", () => {
  it("connects with the stored token once the session is authenticated", async () => {
    renderBridge();

    await waitFor(() => expect(mockConnect).toHaveBeenCalledWith("access-token"));
  });

  it("subscribes to every server event the gateway emits", () => {
    renderBridge();

    expect(mockOn.mock.calls.map(([event]) => event as string).sort()).toEqual([
      "chat:message",
      "delivery:status",
      "location:driver",
      "offer:accepted",
      "offer:new",
      "offer:rejected",
    ]);
  });

  it("attaches handlers before dialling, so nothing arriving early is missed", async () => {
    renderBridge();
    await waitFor(() => expect(mockConnect).toHaveBeenCalled());

    // SocketService replays registered listeners onto the socket connect()
    // builds, so this order is free -- but the reverse has a real gap against
    // a fast local backend.
    expect(mockOn).toHaveBeenCalledTimes(6);
    expect(mockOn.mock.invocationCallOrder[5]).toBeLessThan(
      mockConnect.mock.invocationCallOrder[0] as number,
    );
  });

  it("joins no room, so a screen decides what it is watching", async () => {
    renderBridge();
    await waitFor(() => expect(mockConnect).toHaveBeenCalled());

    // Rooms are opt-in on the gateway. Joining here would either subscribe the
    // app to everything or -- worse -- look like it had, while the ids it
    // guessed were wrong.
    expect(mockOn.mock.calls.every(([event]) => (event as string).startsWith("chat:join"))).toBe(
      false,
    );
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it("does not connect while the session is anonymous, and disconnects", async () => {
    mockStatus = "anonymous";

    renderBridge();

    await waitFor(() => expect(mockDisconnect).toHaveBeenCalled());
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("does not connect while the session is still unknown", async () => {
    mockStatus = "unknown";

    renderBridge();

    await waitFor(() => expect(mockDisconnect).toHaveBeenCalled());
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("does not connect under skipAuth, which has no backend to dial", async () => {
    mockSkipAuth = true;

    renderBridge();

    await waitFor(() => expect(mockDisconnect).toHaveBeenCalled());
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("does not connect when the keychain holds no token", async () => {
    mockToken = null;

    renderBridge();

    await waitFor(() => expect(mockReadAccess).toHaveBeenCalled());
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("does not connect when the keychain read resolves after unmount", async () => {
    // Sign-out landing while the read is in flight: connecting afterwards
    // would open a socket with a credential the app has already discarded.
    let resolveRead: (token: string | null) => void = () => undefined;
    mockReadAccess.mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          resolveRead = resolve;
        }),
    );

    const { unmount } = renderBridge();
    unmount();
    resolveRead("access-token");
    await Promise.resolve();

    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("unsubscribes every handler and disconnects on unmount", async () => {
    const { unmount } = renderBridge();
    await waitFor(() => expect(mockConnect).toHaveBeenCalled());

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(6);
    expect(mockDisconnect).toHaveBeenCalled();
  });
});

describe("toRealtimeCache", () => {
  it("writes through to the query client's cache", () => {
    const queryClient = new QueryClient();
    const cache = toRealtimeCache(queryClient);

    cache.setQueryData(queryKeys.driverLocation("livreur-1"), () => ({ lat: 5.6, lng: -0.19 }));

    expect(queryClient.getQueryData(queryKeys.driverLocation("livreur-1"))).toEqual({
      lat: 5.6,
      lng: -0.19,
    });
  });

  it("passes the previous value to the updater, so an append can see the thread", () => {
    const queryClient = new QueryClient();
    const cache = toRealtimeCache(queryClient);
    queryClient.setQueryData(queryKeys.messages("d-1"), ["first"]);

    cache.setQueryData<string[]>(queryKeys.messages("d-1"), (previous) => [
      ...(previous ?? []),
      "second",
    ]);

    expect(queryClient.getQueryData(queryKeys.messages("d-1"))).toEqual(["first", "second"]);
  });

  it("invalidates by prefix, so invalidating an order reaches its offers", async () => {
    const queryClient = new QueryClient();
    const cache = toRealtimeCache(queryClient);
    queryClient.setQueryData(queryKeys.offers("order-1"), []);

    cache.invalidateQueries(queryKeys.order("order-1"));

    await waitFor(() =>
      expect(queryClient.getQueryState(queryKeys.offers("order-1"))?.isInvalidated).toBe(true),
    );
  });
});
