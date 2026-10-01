import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { useSetOnline } from "./driver";
import { useAuthStore } from "../state/authStore";

const mockSetDriverStatus = jest.fn();

jest.mock("../api/client", () => ({
  api: {
    setDriverStatus: (...args: unknown[]) => mockSetDriverStatus(...args),
  },
  setOnSessionExpired: jest.fn(),
}));

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useSetOnline(), { wrapper }), queryClient };
}

const DRIVER = { id: "u-1", fullName: "Kofi Boateng", isOnline: false } as never;

beforeEach(() => {
  mockSetDriverStatus.mockReset().mockResolvedValue({ isOnline: true });
  useAuthStore.setState({ status: "authenticated", user: DRIVER });
});

describe("useSetOnline", () => {
  it("writes the new flag into the auth store, which is what the screens read", async () => {
    // The defect this guards: invalidating `["auth","me"]` looks right and is
    // a no-op -- nothing subscribes to it. The home screen went on rendering
    // the old flag, so the switch snapped back, the position never published
    // and the nearby search stayed disabled.
    const { result } = setup();

    result.current.mutate(true);

    await waitFor(() => expect(useAuthStore.getState().user?.isOnline).toBe(true));
  });

  it("takes the flag from the server's answer rather than from what was asked", async () => {
    mockSetDriverStatus.mockResolvedValue({ isOnline: false });
    const { result } = setup();

    result.current.mutate(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().user?.isOnline).toBe(false);
  });

  it("leaves the rest of the user untouched", async () => {
    const { result } = setup();

    result.current.mutate(true);

    await waitFor(() => expect(useAuthStore.getState().user?.isOnline).toBe(true));
    expect(useAuthStore.getState().user?.fullName).toBe("Kofi Boateng");
  });

  it("does nothing to a signed-out store", async () => {
    // A response landing after sign-out must not resurrect a user.
    useAuthStore.setState({ status: "anonymous", user: null });
    const { result } = setup();

    result.current.mutate(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("never replays -- the flag is the driver's own statement of availability", async () => {
    mockSetDriverStatus.mockRejectedValue(new Error("500"));
    const { result } = setup();

    result.current.mutate(true);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockSetDriverStatus).toHaveBeenCalledTimes(1);
  });
});
