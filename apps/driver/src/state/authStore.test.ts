import type { User } from "@kaya/core";
import { ApiFailure } from "@kaya/core";
import * as SecureStore from "expo-secure-store";

// authStore reads through a real SecureTokenStore (@kaya/ui) rather than a
// stub, so a rejecting keychain read genuinely exercises SecureTokenStore's
// own degrade-to-null behaviour end to end -- mocking the class instead would
// only prove the mock behaves, not the wiring.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  AFTER_FIRST_UNLOCK: "AFTER_FIRST_UNLOCK",
}));

// The api client singleton talks real HTTP; authStore only needs its `me()`
// method and the session-expiry seam, both stubbed here. The jest.fn()s live
// inside the factory (not in outer `const`s) because jest.mock is hoisted
// above every import in this file, including the later ones below -- a
// factory that closed over an outer `const` would run before that `const`
// was initialised.
jest.mock("../api/client", () => ({
  api: { me: jest.fn() },
  setOnSessionExpired: jest.fn(),
}));

import { api, setOnSessionExpired } from "../api/client";
import { env } from "../config/env";
import { useAuthStore } from "./authStore";

const mockedGet = SecureStore.getItemAsync as jest.Mock;
const mockMe = api.me as jest.Mock;
const mockSetOnSessionExpired = setOnSessionExpired as jest.Mock;

// Captured immediately after the module graph above finishes evaluating --
// i.e. before any `beforeEach` in this file has had a chance to run -- since
// authStore.ts wires this handler exactly once, at import time.
const sessionExpiredCallsAtModuleLoad = mockSetOnSessionExpired.mock.calls.length;
const sessionExpiredHandler = mockSetOnSessionExpired.mock.calls[0]?.[0] as
  | (() => void)
  | undefined;

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

describe("authStore", () => {
  beforeEach(() => {
    mockMe.mockReset();
    mockedGet.mockReset();
    env.skipAuth = false;
    useAuthStore.setState({ status: "unknown", user: null });
  });

  it("wires the session-expiry handler exactly once, at module load", () => {
    expect(sessionExpiredCallsAtModuleLoad).toBe(1);
    expect(sessionExpiredHandler).toBeInstanceOf(Function);
  });

  it("starts unknown, with no user", () => {
    expect(useAuthStore.getState()).toMatchObject({ status: "unknown", user: null });
  });

  it("resolves to anonymous when no token is stored, and never calls /auth/me", async () => {
    mockedGet.mockResolvedValue(null);

    await useAuthStore.getState().restoreSession();

    expect(useAuthStore.getState()).toMatchObject({ status: "anonymous", user: null });
    expect(mockMe).not.toHaveBeenCalled();
  });

  it("resolves to anonymous when the keychain read rejects, which SecureTokenStore degrades to null", async () => {
    mockedGet.mockRejectedValue(new Error("keychain unavailable"));

    await useAuthStore.getState().restoreSession();

    expect(useAuthStore.getState()).toMatchObject({ status: "anonymous", user: null });
    expect(mockMe).not.toHaveBeenCalled();
  });

  it("resolves to authenticated with the profile when a stored token and /auth/me both succeed", async () => {
    mockedGet.mockResolvedValue("stored-access-token");
    mockMe.mockResolvedValue(testUser);

    await useAuthStore.getState().restoreSession();

    expect(useAuthStore.getState()).toMatchObject({ status: "authenticated", user: testUser });
  });

  it("resolves to anonymous when /auth/me rejects with a 401 for a stale token", async () => {
    mockedGet.mockResolvedValue("stale-access-token");
    mockMe.mockRejectedValue(
      new ApiFailure({ kind: "unauthorized", message: "expired", statusCode: 401 }),
    );

    await useAuthStore.getState().restoreSession();

    expect(useAuthStore.getState()).toMatchObject({ status: "anonymous", user: null });
  });

  it("resolves to anonymous on any other /auth/me failure, never leaving status unknown", async () => {
    mockedGet.mockResolvedValue("stored-access-token");
    mockMe.mockRejectedValue(new ApiFailure({ kind: "network", message: "offline" }));

    await useAuthStore.getState().restoreSession();

    expect(useAuthStore.getState().status).not.toBe("unknown");
    expect(useAuthStore.getState()).toMatchObject({ status: "anonymous", user: null });
  });

  describe("skipAuth", () => {
    afterEach(() => {
      env.skipAuth = false;
    });

    it("authenticates with a preview driver without touching the keychain or the network", async () => {
      env.skipAuth = true;

      await useAuthStore.getState().restoreSession();

      expect(useAuthStore.getState().status).toBe("authenticated");
      expect(useAuthStore.getState().user).not.toBeNull();
      expect(useAuthStore.getState().user?.role).toBe("livreur");
      expect(mockedGet).not.toHaveBeenCalled();
      expect(mockMe).not.toHaveBeenCalled();
    });
  });

  it("flips an authenticated session to anonymous when the api client reports the session expired", () => {
    useAuthStore.setState({ status: "authenticated", user: testUser });

    sessionExpiredHandler?.();

    expect(useAuthStore.getState()).toMatchObject({ status: "anonymous", user: null });
  });
});
