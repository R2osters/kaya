// authStore.ts (imported transitively below) reads through expo-secure-store
// and wires itself into ../api/client at module load -- both mocked the same
// way authStore.test.ts mocks them, so this file can use the real authStore
// and genuinely observe the session-clearing side effect under test, without
// touching a keychain or real HTTP client.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  AFTER_FIRST_UNLOCK: "AFTER_FIRST_UNLOCK",
}));
jest.mock("../api/client", () => ({
  api: { me: jest.fn() },
  setOnSessionExpired: jest.fn(),
}));

import type { User } from "@kaya/core";
import { ApiFailure } from "@kaya/core";
import { type QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { useAuthStore } from "./authStore";
import { createQueryClient } from "./queryClient";

// Every QueryClient this file creates is tracked here and cleared in
// afterEach. Without it, each query/mutation schedules a real (non-unref'd)
// garbage-collection setTimeout keyed to its gcTime (5 minutes by default);
// left pending, those timers keep the Jest worker process alive well past
// the test run finishing, which is what actually happened before this was
// added -- the suite passed in under a second but the process then hung.
// `client.clear()` removes every cached query/mutation, which cancels their
// gcTimeout as part of tearing each one down.
const createdClients: QueryClient[] = [];
function testQueryClient(): QueryClient {
  const client = createQueryClient();
  createdClients.push(client);
  return client;
}

const testUser: User = {
  id: "driver-1",
  email: "kofi@example.com",
  phone: "+233200000001",
  fullName: "Kofi Owusu",
  role: "livreur",
  countryCode: "GHA",
  age: null,
  city: null,
  profilePhoto: null,
  idCardPhoto: null,
  isVerified: true,
  isActive: true,
  isOnline: true,
  ratingDriver: 5,
  ratingClient: 5,
  totalDeliveries: 0,
  dailyDeliveries: 0,
  balance: 0,
  driverLicenseNumber: "GH-000001",
  driverLicensePhoto: null,
  driverQrCode: null,
  vehicleType: "moto",
  vehicleRegistration: null,
  vehiclePhoto: null,
};

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("queryClient", () => {
  beforeEach(() => {
    useAuthStore.setState({ status: "unknown", user: null });
  });

  afterEach(() => {
    for (const client of createdClients.splice(0)) {
      client.clear();
    }
  });

  describe("money mutations are never retried automatically", () => {
    it("does not retry a mutation even on an otherwise-retryable network failure", async () => {
      // Payment and withdrawal calls are useMutation hooks that take no
      // per-call retry option -- the whole point is that the default itself
      // must already be "never retry", not something each call site has to
      // remember. This proves the *default*, not an opt-out passed here.
      const client = testQueryClient();
      const mutationFn = jest
        .fn()
        .mockRejectedValue(new ApiFailure({ kind: "network", message: "offline" }));

      const { result } = renderHook(() => useMutation({ mutationFn }), {
        wrapper: wrapperFor(client),
      });

      result.current.mutate(undefined);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(mutationFn).toHaveBeenCalledTimes(1);
    });

    it("exposes retry: false as the queryClient's default for every mutation", () => {
      const client = testQueryClient();
      expect(client.getDefaultOptions().mutations?.retry).toBe(false);
    });
  });

  describe("query retry policy", () => {
    it("retries network and timeout failures, but not other failure kinds", () => {
      const client = testQueryClient();
      const retry = client.getDefaultOptions().queries?.retry;
      if (typeof retry !== "function") throw new Error("expected a retry function");

      expect(retry(0, new ApiFailure({ kind: "network", message: "offline" }))).toBe(true);
      expect(retry(0, new ApiFailure({ kind: "timeout", message: "timed out" }))).toBe(true);

      for (const kind of [
        "validation",
        "forbidden",
        "notFound",
        "conflict",
        "unauthorized",
        "cancelled",
        "unknown",
      ] as const) {
        expect(retry(0, new ApiFailure({ kind, message: kind }))).toBe(false);
      }
    });

    it("stops retrying a network failure once the retry cap is reached", () => {
      const client = testQueryClient();
      const retry = client.getDefaultOptions().queries?.retry;
      if (typeof retry !== "function") throw new Error("expected a retry function");
      const error = new ApiFailure({ kind: "network", message: "offline" });

      expect(retry(0, error)).toBe(true);
      expect(retry(1, error)).toBe(true);
      expect(retry(2, error)).toBe(true);
      expect(retry(3, error)).toBe(false);
    });

    it("does not retry a query that fails with a validation error", async () => {
      const client = testQueryClient();
      const queryFn = jest
        .fn()
        .mockRejectedValue(new ApiFailure({ kind: "validation", message: "bad input" }));

      const { result } = renderHook(
        () => useQuery({ queryKey: ["probe"], queryFn }),
        { wrapper: wrapperFor(client) },
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(queryFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("unauthorized clears the session", () => {
    it("flips an authenticated session to anonymous when a query fails unauthorized", async () => {
      useAuthStore.setState({ status: "authenticated", user: testUser });
      const client = testQueryClient();
      const queryFn = jest.fn().mockRejectedValue(
        new ApiFailure({ kind: "unauthorized", message: "expired", statusCode: 401 }),
      );

      const { result } = renderHook(
        () => useQuery({ queryKey: ["me"], queryFn }),
        { wrapper: wrapperFor(client) },
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
      // The guard (app/_layout.tsx's AuthGuard) reacts to this status change
      // by redirecting to /welcome -- see src/navigation/authGuard.ts rule 2.
      expect(useAuthStore.getState()).toMatchObject({ status: "anonymous", user: null });
    });

    it("flips an authenticated session to anonymous when a mutation fails unauthorized", async () => {
      useAuthStore.setState({ status: "authenticated", user: testUser });
      const client = testQueryClient();
      const mutationFn = jest.fn().mockRejectedValue(
        new ApiFailure({ kind: "unauthorized", message: "expired", statusCode: 401 }),
      );

      const { result } = renderHook(() => useMutation({ mutationFn }), {
        wrapper: wrapperFor(client),
      });
      result.current.mutate(undefined);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(useAuthStore.getState()).toMatchObject({ status: "anonymous", user: null });
    });

    it("leaves the session alone when a query fails with a kind other than unauthorized", async () => {
      useAuthStore.setState({ status: "authenticated", user: testUser });
      const client = testQueryClient();
      const queryFn = jest
        .fn()
        .mockRejectedValue(new ApiFailure({ kind: "notFound", message: "missing" }));

      const { result } = renderHook(
        () => useQuery({ queryKey: ["probe"], queryFn }),
        { wrapper: wrapperFor(client) },
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(useAuthStore.getState()).toMatchObject({ status: "authenticated", user: testUser });
    });
  });
});
