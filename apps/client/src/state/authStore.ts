import type { User } from "@kaya/core";
import { SecureTokenStore } from "@kaya/ui";
import { create } from "zustand";
import { api, setOnSessionExpired } from "../api/client";
import { env } from "../config/env";

/**
 * Mirrors the Dart original's `AuthStatus` (`legacy/flutter/client/lib/providers/auth_provider.dart`),
 * renamed `unauthenticated` -> `anonymous` per the phase 1C task 3 brief.
 * `unknown` is the only state the route guard (src/navigation/authGuard.ts)
 * holds navigation on -- see its rule 1.
 */
export type AuthStatus = "unknown" | "authenticated" | "anonymous";

export interface AuthStoreState {
  status: AuthStatus;
  user: User | null;
  /**
   * Reads the session token through SecureTokenStore and confirms it against
   * `/auth/me`. Always settles to either "authenticated" or "anonymous" --
   * never leaves `status` at "unknown" -- because the route guard holds all
   * navigation on the splash screen for as long as it stays "unknown".
   */
  restoreSession: () => Promise<void>;
}

// A fresh instance is equivalent to reusing the one in src/api/client.ts:
// SecureTokenStore carries no state of its own, it only wraps
// expo-secure-store's fixed key names, so two instances read/write the same
// keychain entries.
const tokenStore = new SecureTokenStore();

/**
 * Dev-only bypass ported from the Dart original's `_skipAuth` bootstrap
 * (`--dart-define=SKIP_AUTH=true`): lets a screen open with no backend
 * running. `env.skipAuth` is read fresh on every `restoreSession()` call
 * rather than captured once, so it stays a pure function of the current
 * config the same way the Dart `bool.fromEnvironment` constant did of the
 * build. app.config.ts's devFlagGuard (tools/devFlagGuard.js) already refuses
 * to build with this true against anything but a local backend, so
 * short-circuiting restoration entirely here -- no keychain read, no network
 * call -- is safe: there is no real session to protect in that configuration.
 */
function previewUser(): User {
  return {
    id: "dev-preview",
    email: "preview@kaya.local",
    phone: "+233200000000",
    fullName: "Preview User",
    role: "client",
    countryCode: "GHA",
    age: null,
    city: null,
    profilePhoto: null,
    idCardPhoto: null,
    isVerified: true,
    isActive: true,
    isOnline: false,
    ratingDriver: 5,
    ratingClient: 5,
    totalDeliveries: 0,
    dailyDeliveries: 0,
    balance: 0,
    driverLicenseNumber: null,
    driverLicensePhoto: null,
    driverQrCode: null,
    vehicleType: null,
    vehicleRegistration: null,
    vehiclePhoto: null,
  };
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  status: "unknown",
  user: null,

  restoreSession: async () => {
    if (env.skipAuth) {
      set({ status: "authenticated", user: previewUser() });
      return;
    }

    const token = await tokenStore.readAccess();
    if (token === null || token === "") {
      set({ status: "anonymous", user: null });
      return;
    }

    try {
      const user = await api.me();
      set({ status: "authenticated", user });
    } catch {
      // Any failure -- expired/invalid token, network error, server error --
      // resolves to anonymous. Never rethrows: an uncaught rejection here
      // would leave `status` at "unknown" forever, stranding the app on the
      // splash screen with no way out (see the brief).
      set({ status: "anonymous", user: null });
    }
  },
}));

/**
 * Wired once, at module load, into the registration seam src/api/client.ts
 * exposes for exactly this purpose. A 401 that survives a failed token
 * refresh (see createHttpClient in @kaya/core) flips the store to anonymous;
 * the route guard reacts to that status change and redirects to /welcome,
 * rather than leaving the app on whatever screen it was showing.
 */
setOnSessionExpired(() => {
  useAuthStore.setState({ status: "anonymous", user: null });
});
